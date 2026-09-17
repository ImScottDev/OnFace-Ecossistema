"use client";

import { useEffect } from "react";

/** Applies the semantic ONFACE bridge to portalled Radix content as well. */
export function OnfaceThemeRoot() {
  useEffect(() => {
    const previous = document.documentElement.getAttribute("data-onface-theme");
    document.documentElement.setAttribute("data-onface-theme", "light");
    return () => {
      if (previous === null) document.documentElement.removeAttribute("data-onface-theme");
      else document.documentElement.setAttribute("data-onface-theme", previous);
    };
  }, []);

  return null;
}
