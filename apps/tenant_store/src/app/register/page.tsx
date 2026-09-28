"use client";

import { IRegister, registerRequest } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Store } from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const router = useRouter();
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data: IRegister = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      password: String(formData.get("password") ?? ""),
    };
    try {
      await registerRequest(data);
      toast.success("Account created successfully.");
      router.push("/login");
    } catch (error) {
      console.log("🚀 ~ page.tsx:36 ~ onSubmit ~ error:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      <Card className="mx-auto w-full max-w-md">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Store className="size-6" />
          </span>
          <CardTitle className="text-xl">Create your account</CardTitle>
          <CardDescription>Start shopping in a few seconds.</CardDescription>
        </CardHeader>

        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4 pb-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="John Doe"
                required
                minLength={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="john@example.com"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={16}
              />
              <p className="text-sm text-muted-foreground">
                Must be 8-16 characters with 1 uppercase and 1 number.
              </p>
            </div>
          </CardContent>

          <CardFooter className="flex-col gap-3 pt-4">
            <Button type="submit" className="w-full" size="lg">
              Create account
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-medium text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
