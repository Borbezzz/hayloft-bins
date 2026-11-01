"use client";

import { useActionState } from "react";
import { login } from "../actions";

export default function Gate() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <main className="shell narrow">
      <p className="kicker">hayloft 711</p>
      <h1 className="title">bin tracker</h1>
      <form action={action} className="gate">
        <label htmlFor="pw" className="sr-only">password</label>
        <input
          id="pw"
          name="password"
          type="password"
          placeholder="password"
          autoComplete="current-password"
          autoFocus
          required
        />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "checking..." : "let me in"}
        </button>
      </form>
      <p className={`error ${error ? "show" : ""}`} role="alert">{error ?? " "}</p>
      <p className="fine">hint: it's what ur supposed to be taking out</p>
    </main>
  );
}
