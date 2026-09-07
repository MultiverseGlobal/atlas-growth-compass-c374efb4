import { useEffect, useRef } from "react";

interface SpatialCanvasProps {
  isProcessing?: boolean;
  requiresIntervention?: boolean;
  isDark?: boolean;
}

export function SpatialCanvas({ 
  isProcessing = false, 
  requiresIntervention = false, 
  isDark = true 
}: SpatialCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;
    let phase = 0;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      targetMouseX = e.clientX;
      targetMouseY = e.clientY;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);

    // Number of cartographic contour lines
    const contourCount = 8;

    const render = () => {
      if (document.hidden) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      mouseX += (targetMouseX - mouseX) * 0.04;
      mouseY += (targetMouseY - mouseY) * 0.04;

      const panX = (mouseX - width / 2) * 0.08;
      const panY = (mouseY - height / 2) * 0.08;

      ctx.clearRect(0, 0, width, height);

      // ── Ambient Volumetric Core ──────────────────────────────────────────
      const grad = ctx.createRadialGradient(
        width / 2 + panX,
        height / 2.5 + panY,
        80,
        width / 2,
        height / 2,
        width * 0.7
      );

      if (isDark) {
        if (requiresIntervention) {
          grad.addColorStop(0, "rgba(245, 158, 11, 0.08)");
          grad.addColorStop(0.5, "rgba(217, 119, 6, 0.025)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        } else if (isProcessing) {
          grad.addColorStop(0, "rgba(16, 185, 129, 0.08)");
          grad.addColorStop(0.5, "rgba(56, 189, 248, 0.025)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        } else {
          grad.addColorStop(0, "rgba(255, 255, 255, 0.03)");
          grad.addColorStop(0.6, "rgba(20, 24, 36, 0.015)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        }
      } else {
        if (requiresIntervention) {
          grad.addColorStop(0, "rgba(245, 158, 11, 0.07)");
          grad.addColorStop(0.5, "rgba(245, 158, 11, 0.015)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        } else if (isProcessing) {
          grad.addColorStop(0, "rgba(16, 185, 129, 0.06)");
          grad.addColorStop(0.5, "rgba(56, 189, 248, 0.015)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        } else {
          grad.addColorStop(0, "rgba(17, 19, 24, 0.02)");
          grad.addColorStop(0.6, "rgba(17, 19, 24, 0.005)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        }
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isProcessing, requiresIntervention, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-700"
      style={{ opacity: isDark ? 0.95 : 0.85 }}
    />
  );
}
