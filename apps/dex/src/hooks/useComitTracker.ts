/**
 * useComitTracker Hook
 * 
 * Tracks Comit transaction lifecycle and provides real-time status updates.
 * Subscribes to chain events to track transaction finalization.
 */

'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { useChain, useEventsSubscription } from '@atlas-sphere/shared';

export type ComitStatus = 
  | 'pending'      // Submitted, waiting for inclusion
  | 'included'     // In a block, waiting for finality
  | 'finalized'    // Finalized on chain
  | 'failed'       // Execution failed
  | 'expired';     // Not included in time

export interface ComitTrackerState {
  comitId: string;
  status: ComitStatus;
  blockNumber?: number;
  blockHash?: string;
  error?: string;
  evmResult?: {
    success: boolean;
    gasUsed: bigint;
    logs: any[];
  };
  svmResult?: {
    success: boolean;
    computeUnits: number;
    logs: any[];
  };
  submittedAt: number;
  includedAt?: number;
  finalizedAt?: number;
}

interface UseComitTrackerOptions {
  /** Timeout in ms before marking as expired (default: 60000) */
  timeout?: number;
  /** Callback when status changes */
  onStatusChange?: (status: ComitStatus, state: ComitTrackerState) => void;
}

/**
 * Hook to track a single Comit transaction
 */
export function useComitTracker(
  comitId: string | null,
  options: UseComitTrackerOptions = {}
) {
  const { timeout = 60000, onStatusChange } = options;
  const { api, isConnected, finalizedBlock } = useChain();
  
  const [state, setState] = useState<ComitTrackerState | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;

  // Subscribe to atlasKernel events
  const { events } = useEventsSubscription(api, {
    enabled: isConnected && !!comitId,
    filter: { section: 'atlasKernel' },
  });

  // Initialize tracker when comitId changes
  useEffect(() => {
    if (!comitId) {
      setState(null);
      return;
    }

    const newState: ComitTrackerState = {
      comitId,
      status: 'pending',
      submittedAt: Date.now(),
    };
    
    setState(newState);
    onStatusChangeRef.current?.('pending', newState);

    // Set expiration timeout
    timeoutRef.current = setTimeout(() => {
      setState((prev) => {
        if (prev && prev.status === 'pending') {
          const expiredState = { ...prev, status: 'expired' as ComitStatus };
          onStatusChangeRef.current?.('expired', expiredState);
          return expiredState;
        }
        return prev;
      });
    }, timeout);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [comitId, timeout]);

  // Process incoming events
  useEffect(() => {
    if (!events || events.length === 0 || !comitId || !state) return;

    for (const event of events) {
      // Check for ComitExecuted event
      if (event.method === 'ComitExecuted') {
        const [eventComitId, submitter, evmSuccess, svmSuccess] = event.data;
        
        if (eventComitId?.toString() === comitId) {
          // Clear timeout
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }

          const success = evmSuccess && svmSuccess;
          const newStatus: ComitStatus = success ? 'included' : 'failed';
          
          const newState: ComitTrackerState = {
            ...state,
            status: newStatus,
            includedAt: Date.now(),
            evmResult: {
              success: !!evmSuccess,
              gasUsed: BigInt(0), // Would come from event data
              logs: [],
            },
            svmResult: {
              success: !!svmSuccess,
              computeUnits: 0,
              logs: [],
            },
            error: success ? undefined : 'Comit execution failed',
          };
          
          setState(newState);
          onStatusChangeRef.current?.(newStatus, newState);
        }
      }

      // Check for ComitSubmitted event
      if (event.method === 'ComitSubmitted') {
        const [eventComitId] = event.data;
        
        if (eventComitId?.toString() === comitId && state.status === 'pending') {
          // Comit was submitted to mempool
        }
      }
    }
  }, [events, comitId, state]);

  // Check for finalization
  useEffect(() => {
    if (!state || state.status !== 'included' || !finalizedBlock || !state.blockNumber) {
      return;
    }

    if (finalizedBlock >= state.blockNumber) {
      const newState: ComitTrackerState = {
        ...state,
        status: 'finalized',
        finalizedAt: Date.now(),
      };
      
      setState(newState);
      onStatusChangeRef.current?.('finalized', newState);
    }
  }, [state, finalizedBlock]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setState(null);
  }, []);

  return {
    state,
    isTracking: !!comitId && !!state,
    reset,
  };
}

/**
 * Hook to track multiple Comit transactions
 */
export function useMultiComitTracker() {
  const { api, isConnected } = useChain();
  const [trackedComits, setTrackedComits] = useState<Map<string, ComitTrackerState>>(new Map());
  
  // Subscribe to atlasKernel events
  const { events } = useEventsSubscription(api, {
    enabled: isConnected,
    filter: { section: 'atlasKernel' },
    maxEvents: 200,
  });

  // Process events for all tracked comits
  useEffect(() => {
    if (!events || events.length === 0) return;

    setTrackedComits((current) => {
      const updated = new Map(current);
      let hasChanges = false;

      for (const event of events) {
        if (event.method === 'ComitExecuted') {
          const [comitId, , evmSuccess, svmSuccess] = event.data;
          const id = comitId?.toString();
          
          if (id && updated.has(id)) {
            const existing = updated.get(id)!;
            if (existing.status === 'pending') {
              const success = evmSuccess && svmSuccess;
              updated.set(id, {
                ...existing,
                status: success ? 'included' : 'failed',
                includedAt: Date.now(),
                error: success ? undefined : 'Comit execution failed',
              });
              hasChanges = true;
            }
          }
        }
      }

      return hasChanges ? updated : current;
    });
  }, [events]);

  const track = useCallback((comitId: string) => {
    setTrackedComits((current) => {
      if (current.has(comitId)) return current;
      
      const updated = new Map(current);
      updated.set(comitId, {
        comitId,
        status: 'pending',
        submittedAt: Date.now(),
      });
      return updated;
    });
  }, []);

  const untrack = useCallback((comitId: string) => {
    setTrackedComits((current) => {
      if (!current.has(comitId)) return current;
      
      const updated = new Map(current);
      updated.delete(comitId);
      return updated;
    });
  }, []);

  const getStatus = useCallback((comitId: string) => {
    return trackedComits.get(comitId);
  }, [trackedComits]);

  const clearFinalized = useCallback(() => {
    setTrackedComits((current) => {
      const updated = new Map(current);
      for (const [id, state] of updated) {
        if (state.status === 'finalized' || state.status === 'expired') {
          updated.delete(id);
        }
      }
      return updated;
    });
  }, []);

  return {
    trackedComits,
    track,
    untrack,
    getStatus,
    clearFinalized,
    pendingCount: Array.from(trackedComits.values()).filter(s => s.status === 'pending').length,
  };
}

export default useComitTracker;
