package main

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"
)

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
	if len(os.Args) < 2 {
		fmt.Println("Usage: ./check_endpoints <json_file> [order]")
		fmt.Println("Order options: Platform, Host, Live, URL")
		os.Exit(1)
	}

	filename := os.Args[1]
	order := "Platform"
	if len(os.Args) > 2 {
		order = os.Args[2]
	}

	fmt.Printf("Loading endpoints from %s...\n", filename)
	endpoints, err := parseEndpoints(filename)
	if err != nil {
		fmt.Printf("Failed to parse file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Checking %d endpoints...\n", len(endpoints))
	
	results := make([]Result, 0, len(endpoints))
	var wg sync.WaitGroup
	var mu sync.Mutex
	
	for _, ep := range endpoints {
		wg.Add(1)
		go func(ep Endpoint) {
			defer wg.Done()
			live := checkLive(ep.URL, nil)
			mu.Lock()
			results = append(results, Result{Platform: ep.Platform, Host: ep.Host, URL: ep.URL, Live: live})
			mu.Unlock()
		}(ep)
	}
	
	wg.Wait()
	
	// Reorder
	switch order {
	case "Platform":
		sort.Slice(results, func(i, j int) bool { return results[i].Platform < results[j].Platform })
	case "Host":
		sort.Slice(results, func(i, j int) bool { return results[i].Host < results[j].Host })
	case "Live":
		sort.Slice(results, func(i, j int) bool { return results[i].Live && !results[j].Live })
	case "URL":
		sort.Slice(results, func(i, j int) bool { return results[i].URL < results[j].URL })
	}
	
	fmt.Println("\nResults:")
	fmt.Println(strings.Repeat("=", 80))
	for _, r := range results {
		status := "DEAD"
		if r.Live {
			status = "LIVE"
		}
		fmt.Printf("[%s] %s (%s) - %s\n", status, r.Platform, r.Host, r.URL)
	}
	
	liveCount := 0
	for _, r := range results {
		if r.Live {
			liveCount++
		}
	}
	fmt.Printf("\nSummary: %d/%d endpoints are live (%.1f%%)\n", liveCount, len(results), float64(liveCount)/float64(len(results))*100)
}