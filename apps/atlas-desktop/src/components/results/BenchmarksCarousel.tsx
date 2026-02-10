import { useState } from "react";

const BENCHMARK_SLIDES = [
  {
    title: "Atlas vs. CUDA vs. CPU",
    content: (
      <div className="text-center">
        <table className="mx-auto text-sm border border-gray-300 rounded-lg">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-2 py-1">Primitive</th>
              <th className="px-2 py-1">Atlas</th>
              <th className="px-2 py-1">CUDA</th>
              <th className="px-2 py-1">CPU</th>
              <th className="px-2 py-1">Atlas vs. CUDA</th>
              <th className="px-2 py-1">Atlas vs. CPU</th>
            </tr>
          </thead>
          <tbody>
            <tr><td>SHA-256</td><td>10.1M</td><td>4.2M</td><td>120K</td><td>2.4x</td><td>84x</td></tr>
            <tr><td>Keccak-256</td><td>45.7M</td><td>18M</td><td>350K</td><td>2.5x</td><td>130x</td></tr>
            <tr><td>Ed25519</td><td>59K</td><td>24K</td><td>1.2K</td><td>2.5x</td><td>49x</td></tr>
            <tr><td>secp256k1</td><td>115.6K</td><td>48K</td><td>1K</td><td>2.4x</td><td>116x</td></tr>
            <tr><td>PoH</td><td>551M</td><td>220M</td><td>2M</td><td>2.5x</td><td>275x</td></tr>
          </tbody>
        </table>
        <div className="mt-2 text-xs text-gray-500">*Ops/sec on GTX 1070. Atlas = GPU + orchestration.</div>
      </div>
    ),
  },
  {
    title: "Real-World Gas Savings",
    content: (
      <div className="text-center">
        <p className="mb-2">Atlas batch relays 115,000 Ethereum signatures/sec vs. 1,000/sec on CPU.<br />
        <span className="font-semibold">99% less wall time</span>, lower risk of reorgs, more txs per block, less wasted gas.</p>
        <div className="bg-green-50 border border-green-200 rounded p-2 text-green-700 text-xs">“Atlas let us batch 10x more txs per block and cut relay costs by 80%.” — Enterprise Validator</div>
      </div>
    ),
  },
  {
    title: "What We Test & Why",
    content: (
      <ul className="list-disc list-inside text-left mx-auto max-w-md text-sm">
        <li><b>Latency:</b> How fast is your RPC? (p50, p90, p99)</li>
        <li><b>Throughput:</b> How many txs/sec can you push?</li>
        <li><b>Reorgs:</b> Can you detect and recover from forks?</li>
        <li><b>Edge Cases:</b> Does it handle bad input safely?</li>
        <li><b>Validator Health:</b> Stake, uptime, liveness</li>
        <li><b>GPU Benchmark:</b> Real ops/sec for 5 crypto kernels</li>
        <li><b>Pool Performance:</b> Mining/staking payout accuracy</li>
      </ul>
    ),
  },
  {
    title: "Customer Quote",
    content: (
      <div className="italic text-center text-lg text-blue-700">“Atlas Sphere is the only platform that let us run 40+ chains on one GPU and see real-time results. Our revenue per block doubled.”<br /><span className="text-sm text-gray-500">— Multi-Chain Operator</span></div>
    ),
  },
];

export default function BenchmarksCarousel() {
  const [idx, setIdx] = useState(0);
  const next = () => setIdx((i) => (i + 1) % BENCHMARK_SLIDES.length);
  const prev = () => setIdx((i) => (i - 1 + BENCHMARK_SLIDES.length) % BENCHMARK_SLIDES.length);
  return (
    <div className="w-full max-w-xl mx-auto bg-white rounded-lg shadow-lg p-4 relative">
      <div className="mb-2 text-xl font-bold text-center">{BENCHMARK_SLIDES[idx].title}</div>
      <div className="min-h-[120px] flex items-center justify-center">{BENCHMARK_SLIDES[idx].content}</div>
      <div className="flex justify-between mt-4">
        <button onClick={prev} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Prev</button>
        <button onClick={next} className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300">Next</button>
      </div>
      <div className="absolute top-2 right-4">
        <a href="/sales" className="text-blue-600 underline text-sm hover:text-blue-800">Click here for more info</a>
      </div>
    </div>
  );
}
