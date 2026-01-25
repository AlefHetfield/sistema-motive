/**
 * Hook para facilitar uso de animações
 * 
 * Uso:
 * const { animClass } = useAnimation('fade-in');
 * <div className={animClass}>Conteúdo</div>
 */

import { useState, useEffect, useRef } from 'react';

export const useAnimation = (animationName = 'fade-in', duration = 300) => {
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAnimating(false);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return {
    animClass: isAnimating ? `animate-${animationName}` : '',
    isAnimating,
  };
};

/**
 * Hook para animações staggered (em sequência)
 * 
 * Uso:
 * const items = useStaggerAnimation(['item1', 'item2', 'item3'], 100);
 */
export const useStaggerAnimation = (items = [], delay = 100) => {
  return items.map((item, index) => ({
    ...item,
    style: {
      animationDelay: `${index * delay}ms`,
    },
  }));
};

/**
 * Hook para animações com observador (Intersection Observer)
 * 
 * Uso:
 * const { ref, isVisible } = useInViewAnimation();
 * <div ref={ref} className={isVisible ? 'animate-fade-in' : ''} />
 */
export const useInViewAnimation = (threshold = 0.1) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};

/**
 * Classes utilitárias para animações
 */
export const animationClasses = {
  // Entradas
  fadeIn: 'animate-fade-in',
  slideInUp: 'animate-slide-in-up',
  slideInDown: 'animate-slide-in-down',
  slideInLeft: 'animate-slide-in-left',
  slideInRight: 'animate-slide-in-right',
  scaleIn: 'animate-scale-in',
  rotateIn: 'animate-rotate-in',
  flipIn: 'animate-flip-in',

  // Efeitos
  pulse: 'animate-pulse-soft',
  bounce: 'animate-bounce-gentle',
  glow: 'animate-glow',
  wiggle: 'animate-wiggle',
  shimmer: 'animate-shimmer',

  // Saídas
  fadeOut: 'animate-fade-out',

  // Micro-interações
  cardHover: 'hover:shadow-lg hover:-translate-y-1 transition-all duration-300',
  buttonPress: 'active:scale-95 transition-transform duration-150',
  linkHover: 'hover:opacity-80 transition-opacity duration-200',
};

/**
 * Função para aplicar animação a um elemento
 */
export const animateElement = (element, animationName, duration = 300) => {
  if (!element) return;

  element.classList.add(`animate-${animationName}`);

  setTimeout(() => {
    element.classList.remove(`animate-${animationName}`);
  }, duration);
};

/**
 * Função para sequência de animações
 */
export const animateSequence = (elements = [], animationName = 'fade-in', delayMs = 100) => {
  elements.forEach((element, index) => {
    setTimeout(() => {
      animateElement(element, animationName);
    }, index * delayMs);
  });
};
