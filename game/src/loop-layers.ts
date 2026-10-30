import type { Layer } from "@engine/gltf/animator";

/** Blend the end of a generated locomotion clip into its start to soften its non-matching loop seam. */
export function loopLayers(clip: string, phase: number, duration: number, weight: number): Layer[] {
  const p = ((phase % 1) + 1) % 1;
  const seam = Math.max(0, Math.min(1, (p - 0.85) / 0.15));
  const w = Math.max(0, Math.min(1, weight));
  const startWeight = w * seam;
  // Sequential layers must preserve the requested total locomotion weight.
  const currentWeight = startWeight < 1 ? w * (1 - seam) / (1 - startWeight) : 0;
  const layers: Layer[] = [{ clip, time: p * duration, weight: currentWeight }];
  if (seam > 0) layers.push({ clip, time: 0, weight: startWeight, loop: false });
  return layers;
}
