"use client";

import { Button } from "@/components/ui/button";

export default function CrmError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="bauhaus-card p-8 border-[#C8372B]">
      <p className="bauhaus-label text-[#C8372B] mb-2">{`// SYSTEM FAULT`}</p>
      <h2 className="font-headline text-[32px] mb-3">Access or Data Fault</h2>
      <p className="text-[14px] text-[var(--fg-grey)] mb-6">{error.message}</p>
      <Button variant="primary" onClick={reset}>
        Retry View
      </Button>
    </div>
  );
}
