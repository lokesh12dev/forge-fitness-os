"use client";

import React, { useEffect, useState } from "react";
import QRCodeLib from "qrcode";

export function QRCode({
  value,
  size = 148,
  label,
}: {
  value: string;
  size?: number;
  label?: string;
}) {
  const [svgMarkup, setSvgMarkup] = useState<string>("");

  useEffect(() => {
    let active = true;
    QRCodeLib.toString(value, {
      type: "svg",
      margin: 1,
      color: {
        dark: "#151515",
        light: "#FFFFFF",
      },
    })
      .then((svg) => {
        if (active) setSvgMarkup(svg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [value]);

  return (
    <div className="inline-flex flex-col items-start gap-2">
      <div
        style={{ width: size, height: size }}
        className="border-2 border-[#151515] bg-[#FFFFFF] p-1.5 flex items-center justify-center"
        aria-label={label ?? `QR code for ${value}`}
      >
        {svgMarkup ? (
          <div className="w-full h-full [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: svgMarkup }} />
        ) : (
          <span className="text-[12px] font-bold uppercase text-[#151515]">QR</span>
        )}
      </div>
      {label && <span className="bauhaus-label text-[var(--fg-grey)]">{label}</span>}
    </div>
  );
}
