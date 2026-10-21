import * as THREE from "three";

export type MiiPose = "idle" | "wave" | "celebrate";
const POSES: MiiPose[] = ["idle", "wave", "celebrate"];
const CLIPS = { idle: "Wait", wave: "Pose.04", celebrate: "Pose.08" };
const PERIOD = { idle: 3.6, wave: 1.35, celebrate: 2.0 };
const smooth = (value: number) => {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

/** One skeleton with continuously weighted animation clips, including interruptions. */
export class MiiMotion {
  readonly mixer: THREE.AnimationMixer;
  readonly actions = {} as Record<MiiPose, THREE.AnimationAction>;
  readonly weights = { idle: 1, wave: 0, celebrate: 0 };
  pose: MiiPose = "idle";
  time = 0;
  blending = false;
  private from = { ...this.weights };
  private blendAt = 0;
  private blendDuration = 0.65;
  private gestureEnd = Infinity;

  constructor(root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const name of POSES) {
      const clip = clips.find((candidate) => candidate.name === CLIPS[name]);
      if (!clip) throw new Error(`Missing Mii animation: ${CLIPS[name]}`);
      this.actions[name] = this.mixer.clipAction(clip).setEffectiveWeight(this.weights[name]).play();
    }
    this.update(0);
  }

  select(next: MiiPose) {
    if (this.pose === next) return;
    // Keep all current weights: interrupting a blend never resets a bone pose.
    this.from = { ...this.weights };
    this.blendAt = this.time;
    this.blendDuration = next === "idle" ? 0.8 : 0.65;
    this.pose = next;
    this.gestureEnd = next === "wave" ? this.time + 3.6 : next === "celebrate" ? this.time + 2.8 : Infinity;
  }

  update(delta: number) {
    this.time += delta;
    if (this.time >= this.gestureEnd) this.select("idle");
    const progress = (this.time - this.blendAt) / this.blendDuration;
    this.blending = progress < 1;
    const mix = smooth(progress);
    for (const name of POSES) {
      this.weights[name] = THREE.MathUtils.lerp(this.from[name], this.pose === name ? 1 : 0, mix);
      const action = this.actions[name];
      action.setEffectiveWeight(this.weights[name]);
      // Sample original joint keyframes along an eased back-and-forth cycle.
      // Both loop ends have zero velocity, with no last-frame-to-first-frame jump.
      const phase = this.time / PERIOD[name] * Math.PI * 2;
      action.time = action.getClip().duration * (0.5 - 0.5 * Math.cos(phase));
    }
    this.mixer.update(0);
  }

  dispose() { this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.mixer.getRoot()); }
}
