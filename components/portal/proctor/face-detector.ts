import { yawRatio, type Observation } from "@/lib/proctor/rules"

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite"

export type FaceDetection = { look: (video: HTMLVideoElement, nowMs: number) => Observation }

/**
 * Loads an on-device face detector. The video never leaves the browser for this: it only counts faces and how far
 * the head is turned. Returns null if it can't load (offline, blocked), and the rest of the exam carries on without it.
 */
export async function loadFaceDetector(): Promise<FaceDetection | null> {
  try {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision")
    const fileset = await FilesetResolver.forVisionTasks(WASM)
    const detector = await FaceDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: "CPU" },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    })
    return {
      look(video, nowMs) {
        const found = detector.detectForVideo(video, nowMs).detections
        const first = found[0]
        const k = first?.keypoints
        return { faces: found.length, yaw: k ? yawRatio(k[0], k[1], k[2]) : null }
      },
    }
  } catch {
    return null
  }
}
