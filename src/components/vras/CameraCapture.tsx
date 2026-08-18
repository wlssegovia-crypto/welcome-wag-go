import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  onCapture: (dataUrl: string) => void;
  value?: string | null;
};

export function CameraCapture({ label, onCapture, value }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setLive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera unavailable — check browser permissions");
    }
  }

  function stop() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  }

  function snap() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    onCapture(canvas.toDataURL("image/jpeg", 0.7));
    stop();
  }

  return (
    <div className="space-y-2">
      <p className="label-caps">{label}</p>
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-secondary/40">
        {live ? (
          <video ref={videoRef} playsInline muted className="size-full object-cover" />
        ) : value ? (
          <img src={value} alt={label} className="size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
            {error ?? "No capture yet"}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {live ? (
          <>
            <Button type="button" size="sm" onClick={snap} className="flex-1">
              <Camera className="size-4" /> Capture
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={stop}>
              <X className="size-4" />
            </Button>
          </>
        ) : (
          <Button type="button" size="sm" variant="secondary" onClick={start} className="flex-1">
            <Camera className="size-4" /> {value ? "Retake" : "Open camera"}
          </Button>
        )}
      </div>
    </div>
  );
}
