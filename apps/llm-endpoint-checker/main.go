package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/theme"
	"fyne.io/fyne/v2/widget"
)

var shodanKey string
var osintMode bool
var githubQuery string
var githubToken string

// Run llm_recon.py and stream output to the UI
func runLLMRecon(proxy string, update func(string), addEndpoint func(Endpoint)) error {
	args := []string{"scripts/llm_recon.py", "--search-all", "--timeout", "4", "--threads", "10"}
	cmd := exec.Command("python3", args...)
	cmd.Dir = exeDir()
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
		line := scanner.Text()
		update(line)
		
		// Parse endpoint lines
		if strings.Contains(line, "Found endpoint:") {
			// Extract URL and live status from line like:
			// "Found endpoint: https://api.openai.com/v1/chat/completions (Live: True)"
			parts := strings.Split(line, "Found endpoint: ")
			if len(parts) == 2 {
				urlAndStatus := strings.TrimSpace(parts[1])
				if strings.Contains(urlAndStatus, " (Live: ") {
					urlParts := strings.Split(urlAndStatus, " (Live: ")
					if len(urlParts) == 2 {
						endpointURL := strings.TrimSpace(urlParts[0])
						
						// Extract platform from URL
						platform := "Unknown"
						if strings.Contains(endpointURL, "openai.com") {
							platform = "OpenAI"
						} else if strings.Contains(endpointURL, "anthropic.com") {
							platform = "Anthropic"
						} else if strings.Contains(endpointURL, "google.com") {
							platform = "Google"
						} else if strings.Contains(endpointURL, "huggingface.com") {
							platform = "HuggingFace"
						} else if strings.Contains(endpointURL, "replicate.com") {
							platform = "Replicate"
						} else if strings.Contains(endpointURL, "togetherai.com") {
							platform = "TogetherAI"
						}
						
						// Extract host
						host := "unknown"
						if u, err := url.Parse(endpointURL); err == nil {
							host = u.Host
						}
						
						endpoint := Endpoint{
							Platform: platform,
							Host:     host,
							URL:      endpointURL,
						}
						
						// Add to results list
						addEndpoint(endpoint)
					}
				}
			}
		}
	}
	errScanner := bufio.NewScanner(stderr)
	for errScanner.Scan() {
		update("[ERR] " + errScanner.Text())
	}
	return cmd.Wait()
}

// Run GPU reconnaissance for mining rigs, data centers, and gaming PCs
func runGPURecon(proxy string, update func(string), addEndpoint func(Endpoint)) error {
	args := []string{"scripts/ollama_recon.py", "--gpu-only", "--timeout", "5", "--threads", "15"}
	cmd := exec.Command("python3", args...)
	cmd.Dir = exeDir()
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
		line := scanner.Text()
		update(line)
		
		// Parse GPU endpoint lines
		if strings.Contains(line, "Found mining GPU at") || 
		   strings.Contains(line, "Found data center GPU at") || 
		   strings.Contains(line, "Found gaming GPU at") {
			// Extract URL from line like:
			// "Found mining GPU at http://example.com:4000"
			parts := strings.Split(line, "Found ")
			if len(parts) == 2 {
				typeAndURL := strings.TrimSpace(parts[1])
				if strings.Contains(typeAndURL, " at ") {
					typeParts := strings.Split(typeAndURL, " at ")
					if len(typeParts) == 2 {
						endpointType := typeParts[0] // "mining GPU", "data center GPU", "gaming GPU"
						endpointURL := strings.TrimSpace(typeParts[1])
						
						// Extract host from URL
						parsedURL, err := url.Parse(endpointURL)
						host := endpointURL
						if err == nil {
							host = parsedURL.Host
						}
						
						endpoint := Endpoint{
							Platform: endpointType,
							Host:     host,
							URL:      endpointURL,
						}
						
						// Add to results list
						addEndpoint(endpoint)
					}
				}
			}
		}
	}
	errScanner := bufio.NewScanner(stderr)
	for errScanner.Scan() {
		update("[ERR] " + errScanner.Text())
	}
	return cmd.Wait()
}

// Run web reconnaissance for exposed Ollama and LM Studio endpoints
func runWebRecon(proxy string, update func(string), addEndpoint func(Endpoint)) error {
	args := []string{"scripts/ollama_recon.py", "--web-only", "--timeout", "5", "--threads", "20"}
	if shodanKey != "" {
		args = append(args, "--shodan-api-key", shodanKey)
	}
	if githubQuery != "" {
		args = append(args, "--github-query", githubQuery)
	}
	if githubToken != "" {
		args = append(args, "--github-token", githubToken)
	}
	if osintMode {
		args = append(args, "--osint")
	}
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
		line := scanner.Text()
		update(line)
		
		// Parse endpoint lines from web recon
		if strings.Contains(line, "Found Ollama at") || strings.Contains(line, "Found LM Studio at") {
			// Extract URL from line like:
			// "Found Ollama at http://example.com:11434"
			parts := strings.Split(line, "Found ")
			if len(parts) == 2 {
				typeAndURL := strings.TrimSpace(parts[1])
				if strings.Contains(typeAndURL, " at ") {
					typeParts := strings.Split(typeAndURL, " at ")
					if len(typeParts) == 2 {
						endpointType := typeParts[0] // "Ollama" or "LM Studio"
						endpointURL := strings.TrimSpace(typeParts[1])
						
						// Extract host from URL
						parsedURL, err := url.Parse(endpointURL)
						host := endpointURL
						if err == nil {
							host = parsedURL.Host
						}
						
						endpoint := Endpoint{
							Platform: endpointType,
							Host:     host,
							URL:      endpointURL,
						}
						
						// Add to results list
						addEndpoint(endpoint)
					}
				}
			}
		}
	}
	errScanner := bufio.NewScanner(stderr)
	for errScanner.Scan() {
		update("[ERR] " + errScanner.Text())
	}
	return cmd.Wait()
}

// Run ollama_recon.py and stream output to the UI
func runOllamaRecon(proxy string, update func(string), addEndpoint func(Endpoint)) error {
	args := []string{"scripts/ollama_recon.py", "--search-all", "--timeout", "3", "--threads", "20"}
	if shodanKey != "" {
		args = append(args, "--shodan-api-key", shodanKey)
	}
	if githubQuery != "" {
		args = append(args, "--github-query", githubQuery)
	}
	if githubToken != "" {
		args = append(args, "--github-token", githubToken)
	}
	if osintMode {
		args = append(args, "--osint")
	}
	cmd := exec.Command("python3", args...)
	cmd.Dir = exeDir()
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
		line := scanner.Text()
		update(line)
		
		// Parse endpoint lines
		if strings.Contains(line, "Found Ollama endpoint:") || strings.Contains(line, "Found LM Studio endpoint:") {
			// Extract host from line like:
			// "Found Ollama endpoint: 192.168.1.100:11434"
			parts := strings.Split(line, "Found ")
			if len(parts) == 2 {
				typeAndHost := strings.TrimSpace(parts[1])
				if strings.Contains(typeAndHost, " endpoint: ") {
					typeParts := strings.Split(typeAndHost, " endpoint: ")
					if len(typeParts) == 2 {
						endpointType := typeParts[0] // "Ollama" or "LM Studio"
						host := strings.TrimSpace(typeParts[1])
						
						// Extract platform and URL
						platform := endpointType
						url := ""
						if endpointType == "Ollama" {
							url = fmt.Sprintf("http://%s/api/tags", host)
						} else if endpointType == "LM Studio" {
							url = fmt.Sprintf("http://%s/v1/models", host)
						}
						
						endpoint := Endpoint{
							Platform: platform,
							Host:     host,
							URL:      url,
						}
						
						// Add to results list
						addEndpoint(endpoint)
					}
				}
			}
		}
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
	data = bytes.TrimSpace(data)
	if len(data) == 0 {
		return nil, fmt.Errorf("empty file")
	}

	// Try JSON array first (llm_recon.py export or legacy arrays)
	if data[0] == '[' {
		var arr []map[string]any
		if err := json.Unmarshal(data, &arr); err != nil {
			return nil, err
		}
		var endpoints []Endpoint
		for _, m := range arr {
			if ep, ok := normalizeFromMap(m); ok {
				endpoints = append(endpoints, ep)
			}
		}
		if len(endpoints) == 0 {
			return nil, fmt.Errorf("no endpoints found in file")
		}
		return endpoints, nil
	}

	// JSON lines or single object
	var endpoints []Endpoint
	dec := json.NewDecoder(bytes.NewReader(data))
	for {
		var m map[string]any
		if err := dec.Decode(&m); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}
		if ep, ok := normalizeFromMap(m); ok {
			endpoints = append(endpoints, ep)
		}
	}
	if len(endpoints) == 0 {
		return nil, fmt.Errorf("no endpoints found in file")
	}
	return endpoints, nil
}

// Use proxy if provided, else direct
func checkLive(url string, client *http.Client) bool {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	if !strings.HasPrefix(url, "http://") && !strings.HasPrefix(url, "https://") {
		url = "http://" + url
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

func normalizeFromMap(m map[string]any) (Endpoint, bool) {
	var ep Endpoint

	if v, ok := m["Platform"].(string); ok {
		ep.Platform = v
	} else if v, ok := m["platform"].(string); ok {
		ep.Platform = v
	}

	if v, ok := m["Host"].(string); ok {
		ep.Host = v
	} else if v, ok := m["host"].(string); ok {
		ep.Host = v
	}

	if v, ok := m["URL"].(string); ok {
		ep.URL = v
	} else if v, ok := m["url"].(string); ok {
		ep.URL = v
	}

	if ep.URL == "" {
		ip, _ := m["ip"].(string)
		port := intFromAny(m["port"])
		if ip != "" && port > 0 {
			ep.URL = fmt.Sprintf("http://%s:%d", ip, port)
			ep.Host = fmt.Sprintf("%s:%d", ip, port)
		}
	}

	if ep.Host == "" && ep.URL != "" {
		if u, err := url.Parse(ep.URL); err == nil {
			ep.Host = u.Host
		}
	}

	return ep, ep.URL != ""
}

func intFromAny(v any) int {
	switch t := v.(type) {
	case float64:
		return int(t)
	case int:
		return t
	case int64:
		return int(t)
	case json.Number:
		i, _ := t.Int64()
		return int(i)
	default:
		return 0
	}
}

func exeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return ""
	}
	return filepath.Dir(exe)
}

func main() {
	a := app.New()
	a.Settings().SetTheme(theme.DarkTheme())
	w := a.NewWindow("LLM Endpoint Checker")
	w.Resize(fyne.NewSize(900, 700))

	fileEntry := widget.NewEntry()
	fileEntry.SetPlaceHolder("Path to llm_recon_results.json")
	fileEntry.SetText(filepath.Join(exeDir(), "llm_recon_results.json"))

	statusLabel := widget.NewLabel("")
	proxyStatus := widget.NewLabel("")
	logWidget := widget.NewMultiLineEntry()
	// logWidget.SetMinRowsVisible(25) // Not available in Fyne v2.3

	// Create list for found endpoints
	var foundEndpoints []Endpoint
	endpointList := widget.NewList(
		func() int {
			return len(foundEndpoints)
		},
		func() fyne.CanvasObject {
			return widget.NewLabel("Template")
		},
		func(id widget.ListItemID, obj fyne.CanvasObject) {
			if label, ok := obj.(*widget.Label); ok && id < len(foundEndpoints) {
				ep := foundEndpoints[id]
				label.SetText(fmt.Sprintf("%s - %s - %s", ep.Platform, ep.Host, ep.URL))
			}
		},
	)

	orderOptions := []string{"Platform", "Host", "Live", "URL"}
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
			proxyList = loadProxies(filepath.Join(exeDir(), "proxylist.txt"))
			proxyManager = NewProxyManager(proxyList)
			proxyStatus.SetText(fmt.Sprintf("Loaded %d proxies", len(proxyList)))
			statusLabel.SetText("Proxy mode enabled")
		} else {
			proxyStatus.SetText("")
			statusLabel.SetText("Proxy mode disabled")
		}
	})
	// Shodan API key entry for automated host discovery
	shodanEntry := widget.NewEntry()
	shodanEntry.SetPlaceHolder("Shodan API key (optional)")
	shodanEntry.OnChanged = func(s string) { shodanKey = s }
	// GitHub dork query entry
	githubEntry := widget.NewEntry()
	githubEntry.SetPlaceHolder("GitHub search query (dork)")
	githubEntry.OnChanged = func(s string) { githubQuery = s }
	githubTokenEntry := widget.NewEntry()
	githubTokenEntry.SetPlaceHolder("GitHub API token (optional)")
	githubTokenEntry.Password = true
	githubTokenEntry.OnChanged = func(s string) { githubToken = s }
	osintToggle := widget.NewCheck("Enable OSINT extras", func(on bool) {
		osintMode = on
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
		logWidget.SetText(sb.String())
		statusLabel.SetText(fmt.Sprintf("Checked %d endpoints", len(results)))
	})

	searchLLMsButton := widget.NewButton("Search for Free LLMs (All Types)", func() {
		statusLabel.SetText("Searching for free LLMs (text, image, video, etc)...")
		logWidget.SetText("")
		foundEndpoints = nil // Clear previous results
		endpointList.Refresh()
		
		var proxy string
		proxyMu.Lock()
		if proxyMode && proxyManager != nil {
			proxy = proxyManager.RandomProxy()
			proxyStatus.SetText("Current proxy: " + proxy)
		}
		proxyMu.Unlock()
		go func() {
			var textBuffer strings.Builder
			err := runLLMRecon(proxy, func(line string) {
				textBuffer.WriteString(line + "\n")
				// Update log UI directly (Fyne v2.3 handles thread safety)
				logWidget.SetText(textBuffer.String())
			}, func(endpoint Endpoint) {
				// Add endpoint to list
				foundEndpoints = append(foundEndpoints, endpoint)
				endpointList.Refresh()
			})
			if err != nil {
				statusLabel.SetText("LLM search error: " + err.Error())
			} else {
				statusLabel.SetText(fmt.Sprintf("LLM search complete. Found %d endpoints.", len(foundEndpoints)))
			}
		}()
	})

	searchOllamaButton := widget.NewButton("Find Exposed Ollama & LM Studio", func() {
		statusLabel.SetText("Scanning for exposed Ollama and LM Studio endpoints...")
		logWidget.SetText("")
		foundEndpoints = nil // Clear previous results
		endpointList.Refresh()
		
		var proxy string
		proxyMu.Lock()
		if proxyMode && proxyManager != nil {
			proxy = proxyManager.RandomProxy()
			proxyStatus.SetText("Current proxy: " + proxy)
		}
		proxyMu.Unlock()
		go func() {
			var textBuffer strings.Builder
			err := runOllamaRecon(proxy, func(line string) {
				textBuffer.WriteString(line + "\n")
				// Update log UI directly (Fyne v2.3 handles thread safety)
				logWidget.SetText(textBuffer.String())
			}, func(endpoint Endpoint) {
				// Add endpoint to list
				foundEndpoints = append(foundEndpoints, endpoint)
				endpointList.Refresh()
			})
			if err != nil {
				statusLabel.SetText("Ollama/LM Studio scan error: " + err.Error())
			} else {
				statusLabel.SetText(fmt.Sprintf("Ollama/LM Studio scan complete. Found %d endpoints.", len(foundEndpoints)))
			}
		}()
	})

	searchWebButton := widget.NewButton("Web Recon for Exposed Endpoints", func() {
		statusLabel.SetText("Performing web reconnaissance for exposed Ollama and LM Studio endpoints...")
		logWidget.SetText("")
		foundEndpoints = nil // Clear previous results
		endpointList.Refresh()
		
		var proxy string
		proxyMu.Lock()
		if proxyMode && proxyManager != nil {
			proxy = proxyManager.RandomProxy()
			proxyStatus.SetText("Current proxy: " + proxy)
		}
		proxyMu.Unlock()
		go func() {
			var textBuffer strings.Builder
			err := runWebRecon(proxy, func(line string) {
				textBuffer.WriteString(line + "\n")
				// Update log UI directly (Fyne v2.3 handles thread safety)
				logWidget.SetText(textBuffer.String())
			}, func(endpoint Endpoint) {
				// Add endpoint to list
				foundEndpoints = append(foundEndpoints, endpoint)
				endpointList.Refresh()
			})
			if err != nil {
				statusLabel.SetText("Web reconnaissance error: " + err.Error())
			} else {
				statusLabel.SetText(fmt.Sprintf("Web reconnaissance complete. Found %d exposed endpoints.", len(foundEndpoints)))
			}
		}()
	})

	searchGPUButton := widget.NewButton("Find GPU Resources (Miners/Data Centers/Gamers)", func() {
		statusLabel.SetText("Performing GPU resource reconnaissance (miners, data centers, gaming rigs)...")
		logWidget.SetText("")
		foundEndpoints = nil // Clear previous results
		endpointList.Refresh()
		
		var proxy string
		proxyMu.Lock()
		if proxyMode && proxyManager != nil {
			proxy = proxyManager.RandomProxy()
			proxyStatus.SetText("Current proxy: " + proxy)
		}
		proxyMu.Unlock()
		go func() {
			var textBuffer strings.Builder
			err := runGPURecon(proxy, func(line string) {
				textBuffer.WriteString(line + "\n")
				// Update log UI directly (Fyne v2.3 handles thread safety)
				logWidget.SetText(textBuffer.String())
			}, func(endpoint Endpoint) {
				// Add endpoint to list
				foundEndpoints = append(foundEndpoints, endpoint)
				endpointList.Refresh()
			})
			if err != nil {
				statusLabel.SetText("GPU reconnaissance error: " + err.Error())
			} else {
				statusLabel.SetText(fmt.Sprintf("GPU reconnaissance complete. Found %d GPU resources.", len(foundEndpoints)))
			}
		}()
	})

	content := container.NewVBox(
		widget.NewLabelWithStyle("LLM Endpoint Checker", fyne.TextAlignCenter, fyne.TextStyle{Bold: true}),
		fileEntry,
		orderSelect,
		proxyToggle,
		rotateProxyBtn,
		shodanEntry,
		osintToggle,
		goButton,
		searchLLMsButton,
		searchOllamaButton,
		searchWebButton,
		searchGPUButton,
		statusLabel,
		proxyStatus,
		widget.NewLabelWithStyle("Search Log:", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		logWidget,
		widget.NewLabelWithStyle("Found Endpoints:", fyne.TextAlignLeading, fyne.TextStyle{Bold: true}),
		endpointList,
	)
	w.SetContent(content)
	w.ShowAndRun()
}
