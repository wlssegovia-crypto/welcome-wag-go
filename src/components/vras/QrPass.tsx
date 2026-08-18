import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Download, Share2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildPassPayload, ROTATION_SECONDS, currentSlot } from "@/lib/vras";

type Props = {
  token: string;
  name: string;
  subtitle: string;
  validUntil?: string | null;
  rotating?: boolean;
};

export function QrPass({ token, name, subtitle, validUntil, rotating = true }: Props) {
  const [payload, setPayload] = useState(() => (rotating ? buildPassPayload(token) : token));
  const [secondsLeft, setSecondsLeft] = useState(ROTATION_SECONDS);

  useEffect(() => {
    if (!rotating) return;
    const tick = () => {
      setPayload(buildPassPayload(token));
      const elapsed = Math.floor(Date.now() / 1000) - currentSlot() * ROTATION_SECONDS;
      setSecondsLeft(ROTATION_SECONDS - elapsed);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [token, rotating]);

  async function share() {
    const url = `${window.location.origin}/pass/${token}`;
    if (navigator.share) {
      await navigator.share({ title: `${name} — access pass`, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    toast.success("Pass link copied — send it by SMS or chat");
  }

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-secondary/40 p-5">
        <div>
          <p className="label-caps">Digital access pass</p>
          <h3 className="mt-1 text-xl font-bold">{name}</h3>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="label-caps">Valid until</p>
          <p className="font-mono text-sm">
            {validUntil ? new Date(validUntil).toLocaleDateString() : "No expiry"}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 p-6">
        <div className="rounded-xl bg-foreground p-4">
          <QRCodeSVG value={payload} size={196} level="M" bgColor="transparent" fgColor="#0b1017" />
        </div>
        {rotating && (
          <p className="font-mono text-xs text-muted-foreground">
            Code rotates in {secondsLeft}s · screenshots expire
          </p>
        )}
        <p className="font-mono text-xs tracking-widest text-primary">{token.slice(0, 18)}</p>
      </div>
      <div className="no-print grid grid-cols-3 gap-2 border-t border-border p-4">
        <Button variant="secondary" size="sm" onClick={share}>
          <Share2 className="size-4" /> Share
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Download className="size-4" /> PDF
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.info("Wallet export: add your Apple/Google Wallet pass certificates to enable")}
        >
          <Wallet className="size-4" /> Wallet
        </Button>
      </div>
    </div>
  );
}
