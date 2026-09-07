import { motion } from "framer-motion";
import React from "react";

interface StaggerGroupProps {
  children: React.ReactNode;
  staggerDelay?: number;
  className?: string;
}

export function StaggerGroup({ children, staggerDelay = 0.05, className = "" }: StaggerGroupProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {React.Children.map(children, (child) => (
        <motion.div
          variants={{
            hidden: { opacity: 0, y: 12 },
            visible: { opacity: 1, y: 0, transition: { type: "spring", damping: 20, stiffness: 200 } },
          }}
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
