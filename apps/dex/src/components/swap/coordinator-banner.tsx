
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	AtomicSwapCoordinatorClient,
	getDefaultCoordinatorBaseUrl,
	type CoordinatorHealth,
	type CoordinatorStats,
} from '@atlas-sphere/atomic-swap-sdk';

export function CoordinatorBanner() {
	const client = useMemo(
		() => new AtomicSwapCoordinatorClient({ baseUrl: getDefaultCoordinatorBaseUrl() }),
		[]
	);

	const [health, setHealth] = useState<CoordinatorHealth | null>(null);
	const [stats, setStats] = useState<CoordinatorStats | null>(null);

	useEffect(() => {
		let cancelled = false;

		async function tick() {
			try {
				const [h, s] = await Promise.all([client.health(), client.stats()]);
				if (!cancelled) {
					setHealth(h);
					setStats(s);
				}
			} catch {
				if (!cancelled) {
					setHealth(null);
					setStats(null);
				}
			}
		}

		tick();
		const id = setInterval(tick, 12_000);
		return () => {
			cancelled = true;
			clearInterval(id);
		};
	}, [client]);

	const endpoint = getDefaultCoordinatorBaseUrl();

	return (
		<div className="rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 mb-6">
			<div className="flex items-center justify-between">
				<div className="text-sm text-slate-200">
					HTLC Coordinator:{' '}
					<span className={health?.ok ? 'text-emerald-300' : 'text-slate-400'}>
						{health?.ok ? 'online' : 'unknown'}
					</span>
					{stats ? (
						<span className="text-slate-400"> · swaps {stats.totalSwaps} · proposals {stats.totalProposals}</span>
					) : null}
				</div>
				<div className="text-xs text-slate-500">{endpoint}</div>
			</div>
		</div>
	);
}
