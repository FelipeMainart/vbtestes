import type { SVGProps } from "react";

export function InstagramIcon(props: Readonly<SVGProps<SVGSVGElement>>) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect
        height="19"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="19"
        x="2.5"
        y="2.5"
      />
      <circle
        cx="12"
        cy="12"
        r="4.25"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="17.45" cy="6.65" fill="currentColor" r="1.15" />
    </svg>
  );
}
