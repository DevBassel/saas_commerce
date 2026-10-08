"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { useNotification } from "@refinedev/core";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/refine-ui/form/auth-shell";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/components/refine-ui/form/auth-schema";
import { toApiError } from "@/api/client";
import { requestOtp } from "@/api/otp.api";

export const ForgotPasswordForm = () => {
  const navigate = useNavigate();
  const { open } = useNotification();

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      await requestOtp(values.email, "PASSWORD_RESET");
      open?.({
        type: "success",
        message: "Reset code sent",
        description: "If that email exists, a reset code is on its way.",
      });
      navigate(`/reset-password?email=${encodeURIComponent(values.email)}`);
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not send reset code",
        description: toApiError(error).message,
      });
    }
  };

  return (
    <AuthShell>
      <Card className="sm:w-114">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <KeyRound className="size-6" />
          </span>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>
            We will email you a code to choose a new password.
          </CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="owner@store.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Sending..." : "Send reset code"}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/login")}
              >
                Back to sign in
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </AuthShell>
  );
};

ForgotPasswordForm.displayName = "ForgotPasswordForm";
