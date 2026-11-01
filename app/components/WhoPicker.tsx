"use client";

import { useTransition } from "react";
import { PEOPLE } from "@/lib/people";
import { pickName } from "../actions";

export default function WhoPicker() {
  const [pending, start] = useTransition();
  return (
    <main className="shell narrow">
      <p className="kicker">ok you're in</p>
      <h1 className="title">who are you</h1>
      <p className="lede">tap your name. you only gotta do this once</p>
      <div className="names">
        {PEOPLE.map((p) => (
          <button
            key={p}
            className="name"
            disabled={pending}
            onClick={() => start(() => pickName(p))}
          >
            {p.toLowerCase()}
          </button>
        ))}
      </div>
      <p className="fine">pls don't log as someone else. we will find out</p>
    </main>
  );
}
