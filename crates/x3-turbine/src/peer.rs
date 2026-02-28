//! Peer Module - P2P peer management

use crate::config::TurbineConfig;
use crate::error::TurbineResult;
use lru::LruCache;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::num::NonZeroUsize;
use std::time::{Duration, Instant};
use tracing::{debug, info};

/// Peer role in the network
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PeerRole {
    /// Validator node
    Validator,
    /// RPC node
    Rpc,
    /// Archive node
    Archive,
    /// Regular peer
    Peer,
}

/// Peer information
#[derive(Debug, Clone)]
pub struct PeerInfo {
    pub id: String,
    pub address: String,
    pub role: PeerRole,
    pub stake: u64,
    pub latency_ms: u64,
    pub last_seen: Instant,
    pub is_active: bool,
}

impl PeerInfo {
    /// Create new peer info
    pub fn new(id: String, address: String, role: PeerRole) -> Self {
        Self {
            id,
            address,
            role,
            stake: 0,
            latency_ms: 0,
            last_seen: Instant::now(),
            is_active: true,
        }
    }
}

/// Peer connection state
#[derive(Debug)]
struct PeerState {
    peer: PeerInfo,
    _shreds_received: u64,
    _shreds_sent: u64,
    _last_slot: Option<u64>,
}

/// Peer manager for handling peer connections
pub struct PeerManager {
    _config: TurbineConfig,
    peers: RwLock<HashMap<String, PeerState>>,
    recent_slots: RwLock<VecDeque<u64>>,
    peer_cache: RwLock<LruCache<String, PeerInfo>>,
}

impl PeerManager {
    /// Create new peer manager
    pub fn new(config: TurbineConfig) -> Self {
        let peer_cache = LruCache::new(
            NonZeroUsize::new(config.peer_cache_size.max(1))
                .expect("peer cache size must be non-zero"),
        );

        Self {
            _config: config,
            peers: RwLock::new(HashMap::new()),
            recent_slots: RwLock::new(VecDeque::new()),
            peer_cache: RwLock::new(peer_cache),
        }
    }

    /// Start the peer manager
    pub async fn start(&self) -> TurbineResult<()> {
        info!("Starting peer manager");
        // In real implementation, would connect to bootstrap nodes
        Ok(())
    }

    /// Stop the peer manager
    pub async fn stop(&self) -> TurbineResult<()> {
        info!("Stopping peer manager");
        Ok(())
    }

    /// Add a peer
    pub fn add_peer(&self, peer: PeerInfo) {
        let mut peers = self.peers.write();
        peers.insert(peer.id.clone(), PeerState {
            peer: peer.clone(),
            _shreds_received: 0,
            _shreds_sent: 0,
            _last_slot: None,
        });
        
        // Update cache
        self.peer_cache.write().put(peer.id.clone(), peer);
    }

    /// Remove a peer
    pub fn remove_peer(&self, peer_id: &str) {
        self.peers.write().remove(peer_id);
        self.peer_cache.write().pop(peer_id);
    }

    /// Get peer by ID
    pub fn get_peer(&self, peer_id: &str) -> Option<PeerInfo> {
        self.peers.read().get(peer_id).map(|s| s.peer.clone())
    }

    /// Get all active peers
    pub fn get_active_peers(&self) -> Vec<PeerInfo> {
        self.peers.read()
            .values()
            .filter(|s| s.peer.is_active)
            .map(|s| s.peer.clone())
            .collect()
    }

    /// Get peer count
    pub fn peer_count(&self) -> usize {
        self.peers.read().len()
    }

    /// Get peers for a specific slot
    pub fn get_peers_for_slot(&self, slot: u64, max_peers: usize) -> Vec<PeerInfo> {
        // Update recent slots
        {
            let mut slots = self.recent_slots.write();
            if slots.len() > 100 {
                slots.pop_front();
            }
            slots.push_back(slot);
        }

        // Get peers sorted by stake (higher stake = more likely to have data)
        let mut peers: Vec<_> = self.peers.read()
            .values()
            .filter(|s| s.peer.is_active)
            .map(|s| &s.peer)
            .cloned()
            .collect();

        // Sort by stake (descending)
        peers.sort_by(|a, b| b.stake.cmp(&a.stake));

        peers.into_iter().take(max_peers).collect()
    }

    /// Request shreds from peers
    pub async fn request_shreds(&self, slot: u64, indices: &[u32]) -> TurbineResult<()> {
        debug!("Requesting shreds for slot {}: {:?}", slot, indices);
        
        let peers = self.get_peers_for_slot(slot, 5);
        
        for peer in peers {
            debug!("Requesting from peer: {}", peer.id);
            // In real implementation, would send actual request
        }
        
        Ok(())
    }

    /// Update peer latency
    pub fn update_latency(&self, peer_id: &str, latency_ms: u64) {
        if let Some(state) = self.peers.write().get_mut(peer_id) {
            state.peer.latency_ms = latency_ms;
            state.peer.last_seen = Instant::now();
        }
    }

    /// Update peer stake
    pub fn update_stake(&self, peer_id: &str, stake: u64) {
        if let Some(state) = self.peers.write().get_mut(peer_id) {
            state.peer.stake = stake;
        }
    }

    /// Check for stale peers
    pub fn cleanup_stale_peers(&self, max_age: Duration) {
        let mut peers = self.peers.write();
        peers.retain(|_, state| {
            state.peer.last_seen.elapsed() < max_age
        });
    }

    /// Get peers by role
    pub fn get_peers_by_role(&self, role: PeerRole) -> Vec<PeerInfo> {
        self.peers.read()
            .values()
            .filter(|s| s.peer.role == role && s.peer.is_active)
            .map(|s| s.peer.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_peer_manager() {
        let config = TurbineConfig::default();
        let manager = PeerManager::new(config);
        
        let peer = PeerInfo::new(
            "test-peer-1".to_string(),
            "/ip4/127.0.0.1/tcp/8001".to_string(),
            PeerRole::Validator,
        );
        
        manager.add_peer(peer);
        assert_eq!(manager.peer_count(), 1);
        
        let peers = manager.get_active_peers();
        assert_eq!(peers.len(), 1);
    }
}
