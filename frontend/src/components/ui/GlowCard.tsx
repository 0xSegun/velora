'use client';

import React from 'react';

interface GlowCardProps {
  id?: string;
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}

export default function GlowCard({ id, children, className = '', hoverable = false }: GlowCardProps) {
  return (
    <div
      id={id}
      className={`
        rounded-2xl glass
        ${hoverable ? 'glass-card hover:transform-none' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
