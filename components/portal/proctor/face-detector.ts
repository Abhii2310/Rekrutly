import { yawRatio, type Observation } from "@/lib/proctor/rules"

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"

export type FaceDetection = { look: (video: HTMLVideoElement, nowMs: number) => Observation }

type Shape = { categoryName: string; score: number }[]
const score = (shape: Shape | undefined, name: string): number => shape?.find((c) => c.categoryName === name)?.score ?? 0

/**
 * Eyes pointing sideways, 0 to 1, from the model's eye-look scores. Looking to one side means one eye turns out and
 * the other turns in, so the two are averaged and the larger side wins.
 */
export function gazeAway(shape: Shape | undefined): number | null {
  if (!shape || shape.length === 0) return null
  const toLeft = (score(shape, "eyeLookOutLeft") + score(shape, "eyeLookInRight")) / 2
  const toRight = (score(shape, "eyeLookInLeft") + score(shape, "eyeLookOutRight")) / 2
  return Math.max(toLeft, toRight)
}

/**
 * Loads an on-device face and eye tracker. The video never leaves the browser for this: it only counts faces, how far the
 * head is turned and where the eyes point. Returns null if it can't load (offline, blocked), and the rest of the exam
 * carries on without it.
 */
export async function loadFaceDetector(): Promise<FaceDetection | null> {
  try {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision")
    const fileset = await FilesetResolver.forVisionTasks(WASM)
    const landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      numFaces: 3,
      outputFaceBlendshapes: true,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
    })
    return {
      look(video, nowMs) {
        const r = landmarker.detectForVideo(video, nowMs)
        const lm = r.faceLandmarks[0]
        // Landmarks 33 and 263 are the outer eye corners, 1 is the tip of the nose.
        const yaw = lm ? yawRatio(lm[33], lm[263], lm[1]) : null
        const gaze = gazeAway(r.faceBlendshapes[0]?.categories)
        return { faces: r.faceLandmarks.length, yaw, gaze }
      },
    }
  } catch {
    return null
  }
}
