export default function BrandLogo({ size = 'md', className = '' }) {
  const heights = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-12 sm:h-14',
    xl: 'h-16 sm:h-20',
  };

  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/assets/figma/logo-official.png"
        alt="GWASena IPB University Logo"
        className={`${heights[size] || 'h-10'} w-auto object-contain`}
      />
    </div>
  );
}
