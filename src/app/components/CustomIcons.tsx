export const SublistIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M3.667 1.5h7.58M.751 1.5h.006M6.582 5h4.664M3.661 5h.006m2.915 3.5h4.664m-7.585 0h.006"
    />
  </svg>
);

export const ParentRelationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="10" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="m11.25 8.496-7.5-.003V1.5m0 0L6.5 4.752M3.75 1.5 1 4.752"
    />
  </svg>
);

export const UnlabeledRelationIcon = ({ empty = false }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="3" height={empty ? 12 : 10} fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M1.006 7.5V9H2.5V7.5H1.006ZM1 1.5V3h1.5V1.5H1Z"
    />
  </svg>
);

export const FlattenIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="9" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M3.915 1h7.58M1 1h.006m2.909 3.5h7.58M3.914 8h7.58M1 4.5h.006M1 8h.006"
    />
  </svg>
);

export const NestedIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="9" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M3.667 1h7.58M.751 1h.006m5.824 3.5h4.664m-7.585 0h.006M9 8h2.246M6.582 8h.008"
    />
  </svg>
);

export const NotesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="9" fill="none">
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
      d="M.99 1h10.494m0 3.5H.996M8.5 8H.99"
    />
  </svg>
);
export const UnpinIconMew = ({ size = 16, fill = "currentColor", stroke = "currentColor", strokeWidth = 2 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
  >
    <path d="m9.617 3.779-.707-.707.707.707Zm6.603 5.665-.651.76.426.365.535-.174-.31-.95Zm5.189.288-.43.902.43-.902Zm.117.055-.43.904.004.001.426-.905Zm.28 2.155.707.707-.707-.707Zm-9.864 9.864-.707-.707.707.707Zm-2.155-.28.906-.423-.002-.006-.904.43Zm-.055-.117.903-.43-.903.43Zm-.288-5.189.951.31.174-.534-.366-.427-.759.651Zm9.07.85a1 1 0 0 0-1.4 1.43l1.4-1.43Zm2.293 5.123a1 1 0 0 0 1.414-1.415l-1.414 1.415Zm-8.47-19.72a1 1 0 0 0-1.414-1.414l1.414 1.414ZM1.06 10.923a1 1 0 1 0 1.414 1.414l-1.414-1.414ZM22.52 2.465a1 1 0 1 0-1.43-1.4l1.43 1.4ZM1.05 21.524a1 1 0 0 0 1.429 1.4l-1.429-1.4Zm4.802-7.955a1 1 0 0 0 1.518-1.302l-1.518 1.302Zm6.414-6.198a1 1 0 1 0 1.303-1.518L12.267 7.37Zm2.901 1.17-.714-.699.714.7Zm1.362 1.854c1.483-.483 3.073-.416 4.449.24l.86-1.806c-1.875-.894-3.998-.964-5.929-.335l.62 1.901Zm4.45.24.117.056.859-1.807-.118-.056-.859 1.807Zm.12.057c.066.031.119.094.131.192l1.984-.257a2.234 2.234 0 0 0-1.262-1.744l-.853 1.809Zm.131.192a.435.435 0 0 1-.132.35l1.414 1.415a2.433 2.433 0 0 0 .702-2.022l-1.983.257ZM11.236 21.1a.428.428 0 0 1-.353.132l-.252 1.984a2.427 2.427 0 0 0 2.019-.702L11.235 21.1Zm-.353.132a.227.227 0 0 1-.189-.128l-1.811.847c.327.7.984 1.168 1.748 1.265l.252-1.984Zm-.191-.134-.056-.118-1.807.86.056.117 1.807-.86Zm-.057-.118c-.655-1.376-.722-2.966-.239-4.45l-1.901-.619c-.63 1.93-.559 4.054.335 5.929l1.805-.86Zm-.31-16.493 2.013-2.013-1.414-1.414L8.91 3.072l1.414 1.414Zm.599-3.427-7.85 7.85 1.414 1.414 7.85-7.85-1.414-1.414Zm-8.45 11.278 2.014-2.014-1.414-1.414-2.014 2.014 1.414 1.414Zm18.626-1.102-9.864 9.864 1.414 1.414 9.864-9.864-1.414-1.414Zm-16.612-.912 5.837-5.837L8.91 3.072 3.073 8.909l1.414 1.414Zm12.626 8.176c1.242 1.217 2.45 2.45 3.694 3.694l1.414-1.415c-1.223-1.223-2.457-2.482-3.708-3.707l-1.4 1.428Zm-9.742-6.232L4.54 8.965l-1.518 1.302 2.832 3.302 1.518-1.302Zm1.595-7.73 3.301 2.834 1.303-1.518-3.302-2.833-1.302 1.518Zm1.238 11.032-.84-.979-1.518 1.303.84.978 1.518-1.302ZM7.89 14.542l-6.84 6.981 1.429 1.4 6.84-6.982-1.43-1.4Zm13.2-13.476-6.637 6.776 1.428 1.4 6.639-6.777-1.43-1.4Zm-6.637 6.776-6.563 6.7 1.428 1.4 6.563-6.7-1.428-1.4Zm.063 1.459 1.052.902 1.302-1.517-1.052-.903L14.517 9.3Z" />
  </svg>
);

export const ViewsIconMew = ({ size = 16, fill = "currentColor", stroke = "currentColor", strokeWidth = 2 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    fill={fill}
    stroke={stroke}
    strokeWidth={strokeWidth}
    viewBox="0 0 24 24"
  >
    <path d="m16.726 10.518-3.624 3.545a1.637 1.637 0 0 1-1.513.42l-4.315-1.001m9.452-2.964-4.315-1.001a1.637 1.637 0 0 0-1.513.42l-3.624 3.545m9.452-2.964 4.677 1.085c.59.137.799.855.37 1.276l-6.808 6.659a1.637 1.637 0 0 1-1.512.42L4.46 17.87a.754.754 0 0 1-.37-1.275l3.183-3.114m9.452-2.964 3.183-3.114a.754.754 0 0 0-.37-1.275l-8.992-2.086a1.637 1.637 0 0 0-1.512.42L2.228 11.12a.754.754 0 0 0 .37 1.276l4.676 1.085" />
  </svg>
);

// TODO: refactor old icons

export const PinCustomIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor">
    <path
      d="m6 2.58 2.89 2.9a2.64 2.64 0 0 0 3.37.3l.37.37-3.08 3.07 3.77 3.76v.34h-.34L9.21 9.56 6.16 12.6l-.37-.37a2.64 2.64 0 0 0-.3-3.36l-2.9-2.89-.85.85a.24.24 0 0 1-.34-.34l5.1-5.1c.1-.09.25-.09.34 0 .1.1.1.25 0 .35L6 2.58Z"
      // strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
  </svg>
);

export const ListIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M4.331 1h8.662M1 1h.007m6.656 4h5.33M4.325 5h.006m3.332 4h5.33M4.325 9h.006m0 4h8.662M1 13h.007"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const StreamIcon = ({ className }: { className?: string }) => (
  <svg width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M10.999 1h-10m12 4h-12m12 4h-12m0 4h9"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SidebarIcon = () => (
  <svg width="12.8" height="12.8" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M3.895 4h.01m.01 6h-.01m2.629 3H11a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2H6.534v12Zm0 0H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h3.404M3.895 7h.01"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SplitIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" width="16" height="16" viewBox="0 0 14 14" className={className}>
    <path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.2"
      d="M7 1h4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7M7 1v12M7 1H3a2 2 0 0 0-2 2v8c0 1.1.9 2 2 2h4M4.5 9 3.18 7.4a.54.54 0 0 1 0-.78L4.5 5m5 4 1.34-1.6a.54.54 0 0 0 0-.78L9.5 5"
    />
  </svg>
);

export const CyclicIcon = ({ className, onClick }: { className?: string; onClick: () => void }) => (
  <svg width="100%" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path
      d="M50 20 
   a 30 30 0 1 1 -20 35"
      fill="none"
      stroke="var(--teal-9)"
      strokeWidth="8"
      height="8"
      markerEnd="url(#arrowhead)"
      transform="rotate(30 50 50)"
    />
    <defs>
      <marker id="arrowhead" markerWidth="6" markerHeight="10" refX="0" refY="2" orient="auto">
        <polygon points="0 0, 3.5 2, 0 4" fill="var(--teal-9)" />
      </marker>
    </defs>
    <rect className="btn" x="0" y="0" width="100%" height="100%" fillOpacity="0" strokeWidth="0" onClick={onClick} />
  </svg>
);

export const SublistsIcon = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M6.48186 4H17.912M2.08472 4H2.09376M10.8775 9.54167H17.9105M6.47281 9.54167H6.48186M10.8775 15.0833H17.9105M6.47281 15.0833H6.48186"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ExpandLineArrowsIcon = () => (
  <svg width="14" height="14" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g fill="currentColor" clipPath="url(#clip0_4832_125)">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.41202 0.570389C7.57185 0.501958 7.74867 0.48358 7.91916 0.517678C8.08965 0.551775 8.2458 0.636748 8.36702 0.761389L11.234 3.62839C11.2805 3.67488 11.3174 3.73007 11.3425 3.79081C11.3677 3.85154 11.3806 3.91664 11.3806 3.98239C11.3806 4.04813 11.3677 4.11323 11.3425 4.17397C11.3174 4.23471 11.2805 4.2899 11.234 4.33639C11.1875 4.38288 11.1323 4.41975 11.0716 4.44491C11.0109 4.47007 10.9458 4.48302 10.88 4.48302C10.8143 4.48302 10.7492 4.47007 10.6884 4.44491C10.6277 4.41975 10.5725 4.38288 10.526 4.33639L7.75002 1.55939L4.97402 4.33639C4.88013 4.43028 4.75279 4.48302 4.62002 4.48302C4.48724 4.48302 4.3599 4.43028 4.26602 4.33639C4.17213 4.2425 4.11938 4.11516 4.11938 3.98239C4.11938 3.84961 4.17213 3.72228 4.26602 3.62839L7.13302 0.762389C7.2135 0.681922 7.30851 0.617449 7.41302 0.572389M4.26603 9.61845C4.31248 9.57189 4.36766 9.53495 4.4284 9.50974C4.48915 9.48454 4.55427 9.47156 4.62003 9.47156C4.6858 9.47156 4.75092 9.48454 4.81167 9.50974C4.87241 9.53495 4.92759 9.57189 4.97403 9.61845L7.75003 12.3945L10.526 9.61745C10.6199 9.52357 10.7473 9.47082 10.88 9.47082C11.0128 9.47082 11.1401 9.52357 11.234 9.61745C11.3279 9.71134 11.3807 9.83868 11.3807 9.97145C11.3807 10.1042 11.3279 10.2316 11.234 10.3255L8.36703 13.1915C8.28688 13.274 8.19096 13.3396 8.08498 13.3845C7.979 13.4293 7.8651 13.4524 7.75003 13.4524C7.63497 13.4524 7.52107 13.4293 7.41509 13.3845C7.3091 13.3396 7.21319 13.274 7.13303 13.1915L4.26603 10.3245C4.21947 10.278 4.18253 10.2228 4.15732 10.1621C4.13212 10.1013 4.11914 10.0362 4.11914 9.97045C4.11914 9.90469 4.13212 9.83957 4.15732 9.77882C4.18253 9.71808 4.21947 9.6629 4.26603 9.61645"
      />
      <path d="M7.39645 5.92033C7.49022 6.01409 7.61739 6.06677 7.75 6.06677C7.88261 6.06677 8.00979 6.01409 8.10355 5.92033C8.19732 5.82656 8.25 5.69938 8.25 5.56677L8.25 1.00092C8.25 0.868312 8.19732 0.741135 8.10355 0.647366C8.00978 0.553598 7.88261 0.50092 7.75 0.50092C7.61739 0.50092 7.49021 0.553598 7.39645 0.647367C7.30268 0.741135 7.25 0.868312 7.25 1.00092L7.25 5.56677C7.25 5.69938 7.30268 5.82656 7.39645 5.92033Z" />
      <path d="M7.39645 13.3059C7.49022 13.3997 7.61739 13.4524 7.75 13.4524C7.88261 13.4524 8.00979 13.3997 8.10355 13.3059C8.19732 13.2122 8.25 13.085 8.25 12.9524L8.25 8.388C8.25 8.25539 8.19732 8.12821 8.10355 8.03444C8.00978 7.94067 7.88261 7.888 7.75 7.888C7.61739 7.888 7.49021 7.94067 7.39645 8.03444C7.30268 8.12821 7.25 8.25539 7.25 8.388L7.25 12.9524C7.25 13.085 7.30268 13.2122 7.39645 13.3059Z" />
    </g>
    <defs>
      <clipPath id="clip0_4832_125">
        <rect width="14" height="14" fill="white" />
      </clipPath>
    </defs>
  </svg>
);

export const StopIcon = ({ size = 12, style }: { size?: number; style?: React.CSSProperties }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" style={style}>
    <rect width="12" height="12" rx="4" fill="currentColor" />
  </svg>
);
