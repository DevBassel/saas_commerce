import type { Metadata } from "next";
import { Check, Layers3, Rocket, ShieldCheck } from "lucide-react";
import { RegisterStoreForm } from "./register-store-form";

export const metadata: Metadata = {
  title: "Start a store",
  description:
    "Create your storefront and owner account in one step, then open your store on its own subdomain.",
  alternates: { canonical: "/register-store" },
};

export default function RegisterStorePage() {
  return (
    <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/8 bg-[#080A0A] px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
      <div className="pointer-events-none absolute -left-40 top-16 size-80 rounded-full bg-[#00C58A]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-48 -top-48 size-96 rounded-full bg-[#00C58A]/8 blur-3xl" />

      <div className="relative grid items-start gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(32rem,1.2fr)] lg:gap-14">
        <div className="flex flex-col lg:sticky lg:top-24 lg:min-h-[40rem] lg:py-8">
          <span className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#00C58A]/25 bg-[#00C58A]/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#00C58A]">
            <Rocket className="size-3.5" />
            Launch in minutes
          </span>

          <h1 className="max-w-xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Your store starts here.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400 lg:text-lg">
            Create the storefront and owner account together. Your isolated
            commerce workspace is provisioned as soon as you submit.
          </p>

          <ol className="mt-10 space-y-6">
            <li className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#00C58A]">
                <Layers3 className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-white">Name your storefront</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Choose the store name and subdomain customers will recognize.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[#00C58A]">
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-white">Create owner access</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Set up the first secure account for managing your new store.
                </p>
              </div>
            </li>
            <li className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[#00C58A]/25 bg-[#00C58A]/10 text-[#00C58A]">
                <Check className="size-5" />
              </span>
              <div>
                <h2 className="font-semibold text-white">Open your live store</h2>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  Sign in, add products, and customize the storefront right away.
                </p>
              </div>
            </li>
          </ol>

          <p className="mt-auto hidden pt-10 text-xs leading-5 text-zinc-600 lg:block">
            Tenant-isolated data and role-based access are included from the
            first login.
          </p>
        </div>

        <RegisterStoreForm />
      </div>
    </section>
  );
}
