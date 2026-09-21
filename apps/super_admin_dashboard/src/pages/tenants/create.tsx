import { useEffect, useState } from "react";
import { useCreate, useLink } from "@refinedev/core";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { z } from "zod";
import { ArrowLeftIcon, StoreIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { InputPassword } from "@/components/refine-ui/form/input-password";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const createStoreSchema = z.object({
  name: z.string().min(1, "Owner name is required"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(16, "Password must be at most 16 characters"),
  storeName: z.string().min(2, "Store name must be at least 2 characters"),
  storeSlug: z
    .string()
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .regex(slugPattern, "Lowercase letters, numbers and hyphens only"),
  subdomain: z
    .string()
    .regex(slugPattern, "Lowercase letters, numbers and hyphens only")
    .optional()
    .or(z.literal("")),
});

type CreateStoreFormValues = z.infer<typeof createStoreSchema>;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

export const TenantsCreate = () => {
  const Link = useLink();
  const navigate = useNavigate();
  const [slugTouched, setSlugTouched] = useState(false);

  const { mutate: createStore, mutation } = useCreate({
    resource: "auth/register-store",
    mutationOptions: {
      onSuccess: () => {
        navigate("/tenants");
      },
    },
  });

  const isPending = mutation.isPending;

  const form = useForm<CreateStoreFormValues>({
    resolver: zodResolver(createStoreSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      storeName: "",
      storeSlug: "",
      subdomain: "",
    },
  });

  const storeName = form.watch("storeName");

  useEffect(() => {
    if (!slugTouched) {
      form.setValue("storeSlug", slugify(storeName));
    }
  }, [storeName, slugTouched, form]);

  const handleSubmit = (values: CreateStoreFormValues) => {
    const payload = {
      name: values.name,
      email: values.email,
      password: values.password,
      storeName: values.storeName,
      storeSlug: values.storeSlug,
      ...(values.subdomain ? { subdomain: values.subdomain } : {}),
    };

    createStore({
      values: payload,
      successNotification: {
        message: `Store "${values.storeName}" created`,
        type: "success",
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link to="/tenants">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Store</h1>
          <p className="text-sm text-muted-foreground">
            Register a new tenant with its store owner account
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StoreIcon className="h-5 w-5" />
            New Tenant
          </CardTitle>
          <CardDescription>
            Creates the tenant schema and the store owner user
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="storeName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Store" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="storeSlug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Store Slug</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="acme-store"
                          {...field}
                          onChange={(e) => {
                            setSlugTouched(true);
                            field.onChange(e);
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        Used for the tenant schema name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="subdomain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subdomain (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acme" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Separator />

              <div className="grid gap-6 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John Doe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Owner Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="owner@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Owner Password</FormLabel>
                    <FormControl>
                      <InputPassword {...field} />
                    </FormControl>
                    <FormDescription>
                      8 to 16 characters
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-end gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/tenants")}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creating..." : "Create Store"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};
