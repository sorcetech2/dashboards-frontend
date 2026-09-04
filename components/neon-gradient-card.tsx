'use client';

import {
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useRef,
  useState
} from 'react';

import { cn } from '@/lib/utils';

interface NeonColorsProps {
  firstColor: string;
  secondColor: string;
}

interface NeonGradientCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /**
   * @default ""
   * @type string
   * @description
   * The className of the card
   */
  className?: string;

  /**
   * @default ""
   * @type ReactNode
   * @description
   * The children of the card
   * */
  children?: ReactNode;

  /**
   * @default 5
   * @type number
   * @description
   * The size of the border in pixels
   * */
  borderSize?: number;

  /**
   * @default 20
   * @type number
   * @description
   * The size of the radius in pixels
   * */
  borderRadius?: number;

  /**
   * @default "{ firstColor: '#ff00aa', secondColor: '#00FFF1' }"
   * @type string
   * @description
   * The colors of the neon gradient
   * */
  neonColors?: NeonColorsProps;
}

const NeonGradientCard = ({
  className,
  children,
  borderSize = 2,
  borderRadius = 20,
  neonColors = {
    firstColor: '#ff00aa',
    secondColor: '#00FFF1'
  },
  ...props
}: NeonGradientCardProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateDimensions = () => {
      const { offsetWidth, offsetHeight } = element;
      setDimensions({ width: offsetWidth, height: offsetHeight });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={
        {
          '--border-size': `${borderSize}px`,
          '--border-radius': `${borderRadius}px`,
          '--neon-first-color': neonColors.firstColor,
          '--neon-second-color': neonColors.secondColor,
          '--card-width': `${dimensions.width}px`,
          '--card-height': `${dimensions.height}px`,
          '--card-content-radius': `${borderRadius - borderSize}px`,
          '--pseudo-element-background-image': `linear-gradient(0deg, ${neonColors.firstColor}, ${neonColors.secondColor})`,
          '--pseudo-element-width': `${dimensions.width + borderSize * 2}px`,
          '--pseudo-element-height': `${dimensions.height + borderSize * 2}px`,
          '--after-blur': `${dimensions.width / 3}px`
        } as CSSProperties
      }
      className={cn(
        'relative z-10 size-full rounded-[var(--border-radius)]',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'relative size-full min-h-[inherit] rounded-[var(--card-content-radius)] bg-gray-100 p-6',
          'before:absolute before:-left-[var(--border-size)] before:-top-[var(--border-size)] before:-z-10 before:block',
          "before:h-[var(--pseudo-element-height)] before:w-[var(--pseudo-element-width)] before:rounded-[var(--border-radius)] before:content-['']",
          'before:bg-[linear-gradient(0deg,var(--neon-first-color),var(--neon-second-color))] before:bg-[length:100%_200%] motion-reduce:before:animate-none',
          'before:animate-background-position-spin',
          'after:absolute after:-left-[var(--border-size)] after:-top-[var(--border-size)] after:-z-10 after:block',
          "after:h-[var(--pseudo-element-height)] after:w-[var(--pseudo-element-width)] after:rounded-[var(--border-radius)] after:blur-[var(--after-blur)] after:content-['']",
          'after:bg-[linear-gradient(0deg,var(--neon-first-color),var(--neon-second-color))] after:bg-[length:100%_200%] after:opacity-80 motion-reduce:after:animate-none',
          'after:animate-background-position-spin',
          'dark:bg-neutral-900'
        )}
      >
        {children}
      </div>
    </div>
  );
};

export { NeonGradientCard };
