"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function scrollToApplication(event?: { preventDefault: () => void }) {
  const target = document.getElementById("apply");
  if (!target) return;
  event?.preventDefault();
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  const field = target.querySelector("input, textarea, select");
  if (field instanceof HTMLElement) field.focus({ preventScroll: true });
}

export function SubmitMusicButton({ className = "" }: { className?: string }) {
  return (
    <Button asChild size="lg" className={`h-14 px-6 text-lg ${className}`}>
      <a href="#apply" onClick={scrollToApplication} className="display">
        SUBMIT YOUR MUSIC NOW
      </a>
    </Button>
  );
}

export function StickySubmitButton() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const target = document.getElementById("apply");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden">
      <SubmitMusicButton className="w-full" />
    </div>
  );
}
