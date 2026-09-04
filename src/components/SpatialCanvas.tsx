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

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = width / 2;
    let mouseY = height / 2;
    let targetMouseX = mouseX;
    let targetMouseY = mouseY;

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

    const particleCount = 75;
    const particles: Array<{
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      size: number;
      baseAlpha: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * 800 + 200,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        size: Math.random() * 2 + 1,
        baseAlpha: Math.random() * 0.5 + 0.2,
      });
    }

    const fov = 400;

    const render = () => {
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      const panX = (mouseX - width / 2) * 0.15;
      const panY = (mouseY - height / 2) * 0.15;

      ctx.clearRect(0, 0, width, height);

      // Ambient Volumetric Depth Radial
      const grad = ctx.createRadialGradient(
        width / 2 + panX * 0.5,
        height / 3 + panY * 0.5,
        100,
        width / 2,
        height / 2,
        width * 0.75
      );

      if (isDark) {
        if (requiresIntervention) {
          grad.addColorStop(0, "rgba(255, 180, 50, 0.08)");
          grad.addColorStop(0.5, "rgba(200, 100, 20, 0.03)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        } else if (isProcessing) {
          grad.addColorStop(0, "rgba(255, 255, 255, 0.07)");
          grad.addColorStop(0.5, "rgba(16, 185, 129, 0.04)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        } else {
          grad.addColorStop(0, "rgba(255, 255, 255, 0.035)");
          grad.addColorStop(0.7, "rgba(16, 20, 32, 0.015)");
          grad.addColorStop(1, "rgba(7, 8, 12, 0)");
        }
      } else {
        // Light Mode: subtle warm cream ambient glow
        if (requiresIntervention) {
          grad.addColorStop(0, "rgba(245, 158, 11, 0.10)");
          grad.addColorStop(0.6, "rgba(245, 158, 11, 0.02)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        } else if (isProcessing) {
          grad.addColorStop(0, "rgba(16, 185, 129, 0.08)");
          grad.addColorStop(0.6, "rgba(59, 130, 246, 0.02)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        } else {
          grad.addColorStop(0, "rgba(0, 0, 0, 0.025)");
          grad.addColorStop(0.7, "rgba(0, 0, 0, 0.005)");
          grad.addColorStop(1, "rgba(248, 247, 244, 0)");
        }
      }

      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // 3D Perspective Floor Horizon Grid
      ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.025)" : "rgba(17, 19, 24, 0.035)";
      ctx.lineWidth = 1;

      const gridY = height * 0.65;
      for (let x = -width; x < width * 2; x += 110) {
        ctx.beginPath();
        ctx.moveTo(x - panX, gridY);
        ctx.lineTo(width / 2 + (x - width / 2) * 0.2 - panX * 0.1, height);
        ctx.stroke();
      }

      // Kinetic Constellation Particles
      const speedMultiplier = isProcessing ? 2.0 : 1;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.x += p.vx * speedMultiplier;
        p.y += p.vy * speedMultiplier;

        if (p.x < -width) p.x = width;
        if (p.x > width) p.x = -width;
        if (p.y < -height) p.y = height;
        if (p.y > height) p.y = -height;

        const scale = fov / (fov + p.z);
        const projX = width / 2 + (p.x - panX) * scale;
        const projY = height / 2 + (p.y - panY) * scale;
        const projSize = Math.max(0.8, p.size * scale);

        if (projX > 0 && projX < width && projY > 0 && projY < height) {
          ctx.beginPath();
          ctx.arc(projX, projY, projSize, 0, Math.PI * 2);

          if (isDark) {
            if (requiresIntervention) {
              ctx.fillStyle = `rgba(255, 200, 100, ${p.baseAlpha * scale * 1.3})`;
            } else if (isProcessing) {
              ctx.fillStyle = `rgba(180, 240, 255, ${p.baseAlpha * scale * 1.4})`;
            } else {
              ctx.fillStyle = `rgba(255, 255, 255, ${p.baseAlpha * scale})`;
            }
          } else {
            // Light Mode particles (refined charcoal dots)
            if (requiresIntervention) {
              ctx.fillStyle = `rgba(217, 119, 6, ${p.baseAlpha * scale * 0.9})`;
            } else if (isProcessing) {
              ctx.fillStyle = `rgba(13, 148, 136, ${p.baseAlpha * scale * 0.8})`;
            } else {
              ctx.fillStyle = `rgba(30, 35, 45, ${p.baseAlpha * scale * 0.5})`;
            }
          }

          ctx.fill();

          // Connective vector threads
          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dz = p.z - p2.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

            if (dist < 130) {
              const scale2 = fov / (fov + p2.z);
              const proj2X = width / 2 + (p2.x - panX) * scale2;
              const proj2Y = height / 2 + (p2.y - panY) * scale2;

              ctx.beginPath();
              ctx.moveTo(projX, projY);
              ctx.lineTo(proj2X, proj2Y);
              const lineAlpha = (1 - dist / 130) * (isDark ? 0.05 : 0.04) * scale;
              ctx.strokeStyle = isDark
                ? `rgba(255, 255, 255, ${lineAlpha})`
                : `rgba(17, 19, 24, ${lineAlpha})`;
              ctx.stroke();
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
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
