package main

import (
	"math/rand"
	"net/http"
	"net/url"
	"sync"
	"time"
)

type ProxyManager struct {
	proxies []string
	current int
	mu      sync.Mutex
}

func NewProxyManager(proxies []string) *ProxyManager {
	return &ProxyManager{proxies: proxies, current: 0}
}

func (pm *ProxyManager) NextProxy() string {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if len(pm.proxies) == 0 {
		return ""
	}
	pm.current = (pm.current + 1) % len(pm.proxies)
	return pm.proxies[pm.current]
}

func (pm *ProxyManager) RandomProxy() string {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	if len(pm.proxies) == 0 {
		return ""
	}
	return pm.proxies[rand.Intn(len(pm.proxies))]
}

func (pm *ProxyManager) HTTPClient() *http.Client {
	proxyURL := pm.RandomProxy()
	if proxyURL == "" {
		return &http.Client{Timeout: 5 * time.Second}
	}
	proxy, _ := url.Parse(proxyURL)
	transport := &http.Transport{Proxy: http.ProxyURL(proxy)}
	return &http.Client{Transport: transport, Timeout: 5 * time.Second}
}
