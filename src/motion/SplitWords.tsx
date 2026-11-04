import React from 'react';

interface SplitWordsProps {
  text: string;
  className?: string;
}

/** Word masks so GSAP can reveal type without fading the whole headline at once. */
export const SplitWords: React.FC<SplitWordsProps> = ({ text, className }) => {
  const words = text.split(' ');
  return (
    <>
      {words.map((word, index) => (
        <span className={`motion-word${className ? ` ${className}` : ''}`} key={`${word}-${index}`}>
          <span className="motion-word-inner">
            {word}
            {index < words.length - 1 ? '\u00A0' : ''}
          </span>
        </span>
      ))}
    </>
  );
};
