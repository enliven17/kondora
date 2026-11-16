"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Tactile and audio feedback for betting interactions.
 * Haptics use navigator.vibrate where available (Android). Sound is opt-in,
 * persisted in localStorage, and synthesized with WebAudio (no assets).
 */

const KEY = "kondora:sound";
const listeners = new Set<() => void>();
let soundOn: boolean | null = null;
let audio: AudioContext | null = null;

function readSound() {
  if (soundOn === null) {
    try {
      soundOn = localStorage.getItem(KEY) === "1";
    } catch {
      soundOn = false;
    }
  }
  return soundOn;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function ctx() {
  if (typeof window === "undefined") return null;
  if (!audio) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audio = new Ctor();
  }
  if (audio.state === "suspended") void audio.resume();
  return audio;
}

function blip(freq: number, duration: number, gain: number, type: OscillatorType = "triangle") {
  const ac = ctx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  amp.gain.setValueAtTime(gain, ac.currentTime);
  amp.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(amp).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* unsupported in this context */
    }
  }
}

export function useFeedback() {
  const sound = useSyncExternalStore(subscribe, readSound, () => false);

  const setSound = useCallback((on: boolean) => {
    soundOn = on;
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* storage blocked */
    }
    listeners.forEach((l) => l());
    if (on) blip(880, 0.06, 0.04);
  }, []);

  /** Small detent, e.g. leverage passing a step. `strong` for whole numbers. */
  const tick = useCallback(
    (strong = false) => {
      vibrate(strong ? 12 : 4);
      if (sound) blip(strong ? 660 : 520, strong ? 0.05 : 0.025, strong ? 0.05 : 0.025);
    },
    [sound],
  );

  /** Confirmed trade. */
  const success = useCallback(() => {
    vibrate([10, 40, 18]);
    if (sound) {
      blip(523.25, 0.12, 0.05, "sine");
      window.setTimeout(() => blip(783.99, 0.22, 0.05, "sine"), 90);
    }
  }, [sound]);

  return { sound, setSound, tick, success };
}
