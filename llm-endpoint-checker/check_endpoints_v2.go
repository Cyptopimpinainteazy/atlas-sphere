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

type ReconResult struct {
	IP       string `json:"ip"`
	Port     int    `json:"port"`
	Platform string `json:"platform"`
	Version  string `json:"version"`
	Models   []struct {
		Name   string  `json:"name"`
		SizeGB float64 `json:"size_gb"`
		Family string  `json:"family"`
		Params string  `json:"params"`
	} `json:"models"`
	ExtraInfo     map[string]interface{} `json:"extra_info"`
	ResponseTime  float64                `json:"response_time_ms"`
	Source        string                 `json:"source"`
}

type Result struct {
	Platform string
	Host     string
	URL      string
	Live     bool
}

func parseReconResults(filename string) ([]ReconResult, error) {
	data, err := ioutil.ReadFile(filename)
	if err != nil {
		return nil, err
	}
	
	var results []ReconResult
	err = json.Unmarshal(data, &results)
	if err != nil {
		return nil, err
	}
	
	return results, nil
}

func generateEndpoints(results []ReconResult) []Result {
	var endpoints []Result
	
	for _, r := range results {
		// Generate URL based on platform and port
		var url string
		switch r.Platform {
		case "Ollama":
			url = fmt.Sprintf("http://%s:%d/api/tags", r.IP, r.Port)
		case "vLLM":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "LM Studio":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "LocalAI":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "text-generation-webui (Oobabooga)":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "KoboldCpp":
			url = fmt.Sprintf("http://%s:%d/api/v1/model", r.IP, r.Port)
		case "llama.cpp server":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "Jan.ai":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		case "OpenWebUI":
			url = fmt.Sprintf("http://%s:%d/api/v1/models", r.IP, r.Port)
		case "ComfyUI":
			url = fmt.Sprintf("http://%s:%d/", r.IP, r.Port)
		case "Automatic1111 / Stable Diffusion WebUI":
			url = fmt.Sprintf("http://%s:%d/sdapi/v1/sd-models", r.IP, r.Port)
		case "TGI (HuggingFace Text Gen Inference)":
			url = fmt.Sprintf("http://%s:%d/info", r.IP, r.Port)
		case "TabbyAPI":
			url = fmt.Sprintf("http://%s:%d/v1/models", r.IP, r.Port)
		default:
			// Default to a generic health check
			url = fmt.Sprintf("http://%s:%d/health", r.IP, r.Port)
		}
		
		endpoints = append(endpoints, Result{
			Platform: r.Platform,
			Host:     r.IP,
			URL:      url,
			Live:     false,
		})
	}
	
	return endpoints
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

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Usage: ./check_endpoints_v2 <json_file> [order]")
		fmt.Println("Order options: Platform, Host, Live, URL")
		os.Exit(1)
	}

	filename := os.Args[1]
	order := "Platform"
	if len(os.Args) > 2 {
		order = os.Args[2]
	}

	fmt.Printf("Loading recon results from %s...\n", filename)
	results, err := parseReconResults(filename)
	if err != nil {
		fmt.Printf("Failed to parse file: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Found %d recon results, generating endpoints...\n", len(results))
	endpoints := generateEndpoints(results)
	
	fmt.Printf("Checking %d endpoints...\n", len(endpoints))
	
	var wg sync.WaitGroup
	var mu sync.Mutex
	
	for i := range endpoints {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			live := checkLive(endpoints[idx].URL, nil)
			mu.Lock()
			endpoints[idx].Live = live
			mu.Unlock()
		}(i)
	}
	
	wg.Wait()
	
	// Reorder
	switch order {
	case "Platform":
		sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].Platform < endpoints[j].Platform })
	case "Host":
		sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].Host < endpoints[j].Host })
	case "Live":
		sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].Live && !endpoints[j].Live })
	case "URL":
		sort.Slice(endpoints, func(i, j int) bool { return endpoints[i].URL < endpoints[j].URL })
	}
	
	fmt.Println("\nResults:")
	fmt.Println(strings.Repeat("=", 80))
	for _, r := range endpoints {
		status := "DEAD"
		if r.Live {
			status = "LIVE"
		}
		fmt.Printf("[%s] %s (%s) - %s\n", status, r.Platform, r.Host, r.URL)
	}
	
	liveCount := 0
	for _, r := range endpoints {
		if r.Live {
			liveCount++
		}
	}
	fmt.Printf("\nSummary: %d/%d endpoints are live (%.1f%%)\n", liveCount, len(endpoints), float64(liveCount)/float64(len(endpoints))*100)
}