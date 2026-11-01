"use client";

import { createContext, useContext } from "react";
import { GREY, hueColor, type Colors } from "@/lib/people";

const Ctx = createContext<Colors>({});
export const ColorsProvider = Ctx.Provider;

/** returns name -> css colour, grey if they haven't picked one */
export function useCol() {
  const colors = useContext(Ctx);
  return (name: string) => {
    const h = colors[name as keyof Colors];
    return typeof h === "number" ? hueColor(h) : GREY;
  };
}
export const useColors = () => useContext(Ctx);
