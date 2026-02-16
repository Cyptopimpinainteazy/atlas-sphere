package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
	"fyne.io/fyne/v2/theme"
)
// Run llm_recon.py and stream output to the UI
func runLLMRecon(proxy string, update func(string)) error {
	args := []string{"../scripts/llm_recon.py", "--search-all", "--timeout", "4", "--threads", "10"}
	cmd := exec.Command("python3", args...)
	if proxy != "" {
		cmd.Env = append(os.Environ(), "HTTP_PROXY="+proxy, "HTTPS_PROXY="+proxy)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		update(scanner.Text())
	}
	errScanner := bufio.NewScanner(stderr)
	for errScanner.Scan() {
		update("[ERR] " + errScanner.Text())
	}
	return cmd.Wait()
}

type Endpoint struct {
	Platform string `json:"Platform"`
	Host     string `json:"Host"`
	URL      string `json:"URL"`
}

type Result struct {
	Platform string
	Host     string
	URL      string
	Live     bool
}

func parseEndpoints(filename string) ([]Endpoint, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	var endpoints []Endpoint
	dec := json.NewDecoder(strings.NewReader(string(data)))
	for {
		var ep Endpoint
		if err := dec.Decode(&ep); err != nil {
			break
		}
		if ep.URL != "" {
			endpoints = append(endpoints, ep)
		}
	}
	return endpoints, nil
}


// Use proxy if provided, else direct
func checkLive(url string, client *http.Client) bool {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	resp, err := client.Get(url)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 400
}

func loadProxies(filename string) []string {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil
	}
	var proxies []string
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			proxies = append(proxies, line)
		}
	}
	return proxies
}

func main() {
	a := app.New()
	a.Settings().SetTheme(theme.DarkTheme())
	w := a.NewWindow("LLM Endpoint Checker")
	w.Resize(fyne.NewSize(900, 700))

	fileEntry := widget.NewEntry()
	fileEntry.SetPlaceHolder("Path to llm_recon_results.json")
	fileEntry.SetText("../llm_recon_results.json")

	statusLabel := widget.NewLabel("")
	proxyStatus := widget.NewLabel("")
	listWidget := widget.NewMultiLineEntry()
	listWidget.SetMinRowsVisible(25)

	orderOptions := []string{"Platform","Host","Live","URL"}
	orderSelect := widget.NewSelect(orderOptions, func(string) {})
	orderSelect.SetSelected("Platform")

	var proxyManager *ProxyManager
	var proxyMode bool
	var proxyList []string
	var proxyMu sync.Mutex

	proxyToggle := widget.NewCheck("Enable Proxy Mode (auto-find free proxies)", func(on bool) {
		proxyMu.Lock()
		defer proxyMu.Unlock()
		proxyMode = on
		if on {
			statusLabel.SetText("Loading proxies...")
			proxyList = loadProxies("proxylist.txt")
			proxyManager = NewProxyManager(proxyList)
			proxyStatus.SetText(fmt.Sprintf("Loaded %d proxies", len(proxyList)))
			statusLabel.SetText("Proxy mode enabled")
		} else {
			proxyStatus.SetText("")
			statusLabel.SetText("Proxy mode disabled")
		}
	})

	rotateProxyBtn := widget.NewButton("Rotate Proxy", func() {
		proxyMu.Lock()
		defer proxyMu.Unlock()
		if proxyManager != nil && len(proxyManager.proxies) > 0 {
			p := proxyManager.NextProxy()
			proxyStatus.SetText("Current proxy: " + p)
		} else {
			proxyStatus.SetText("No proxies loaded")
		}
	})

	goButton := widget.NewButton("Go", func() {
		statusLabel.SetText("Loading...")
		endpoints, err := parseEndpoints(fileEntry.Text)
		if err != nil {
			statusLabel.SetText("Failed to parse file: " + err.Error())
			return
		}
		results := make([]Result, 0, len(endpoints))
		var wg sync.WaitGroup
		var mu sync.Mutex
		for _, ep := range endpoints {
			wg.Add(1)
			go func(ep Endpoint) {
				defer wg.Done()
				var client *http.Client
				proxyMu.Lock()
				if proxyMode && proxyManager != nil {
					client = proxyManager.HTTPClient()
				}
				proxyMu.Unlock()
				live := checkLive(ep.URL, client)
				mu.Lock()
				results = append(results, Result{Platform: ep.Platform, Host: ep.Host, URL: ep.URL, Live: live})
				mu.Unlock()
			}(ep)
		}
		wg.Wait()
		// Reorder
		switch orderSelect.Selected {
		case "Platform":
			sort.Slice(results, func(i, j int) bool { return results[i].Platform < results[j].Platform })
		case "Host":
			sort.Slice(results, func(i, j int) bool { return results[i].Host < results[j].Host })
		case "Live":
			sort.Slice(results, func(i, j int) bool { return results[i].Live && !results[j].Live })
		case "URL":
			sort.Slice(results, func(i, j int) bool { return results[i].URL < results[j].URL })
		}
		var sb strings.Builder
		for _, r := range results {
			status := "DEAD"
			if r.Live {
				status = "LIVE"
			}
			sb.WriteString(fmt.Sprintf("[%s] %s (%s) - %s\n", status, r.Platform, r.Host, r.URL))
		}
		listWidget.SetText(sb.String())
		statusLabel.SetText(fmt.Sprintf("Checked %d endpoints", len(results)))
	})

	searchLLMsButton := widget.NewButton("Search for Free LLMs (All Types)", func() {
		statusLabel.SetText("Searching for free LLMs (text, image, video, etc)...")
		listWidget.SetText("")
		var proxy string
		proxyMu.Lock()
		if proxyMode && proxyManager != nil {
			proxy = proxyManager.RandomProxy()
			proxyStatus.SetText("Current proxy: " + proxy)
		}
		proxyMu.Unlock()
		go func() {
			err := runLLMRecon(proxy, func(line string) {
				fyne.CurrentApp().SendNotification(&fyne.Notification{Title: "LLM Recon", Content: line})
				listWidget.SetText(listWidget.Text + line + "\n")
			})
			if err != nil {
				statusLabel.SetText("LLM search error: " + err.Error())
			} else {
				statusLabel.SetText("LLM search complete.")
			}
		}()
	})

	content := container.NewVBox(
		widget.NewLabelWithStyle("LLM Endpoint Checker", fyne.TextAlignCenter, fyne.TextStyle{Bold: true}),
		fileEntry,
		orderSelect,
		proxyToggle,
		rotateProxyBtn,
		goButton,
		searchLLMsButton,
		statusLabel,
		proxyStatus,
		listWidget,
	)
	w.SetContent(content)
	w.ShowAndRun()
}
