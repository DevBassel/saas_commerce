"use client";

import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const ActiveField = ({
  name = "isActive",
  description,
}: {
  name?: string;
  description?: string;
}) => {
  const { control } = useFormContext();

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem
          className={cn(
            "flex",
            "flex-row",
            "items-center",
            "justify-between",
            "rounded-md",
            "border",
            "p-4"
          )}
        >
          <div className="space-y-0.5">
            <FormLabel>Active</FormLabel>
            {description ? (
              <FormDescription>{description}</FormDescription>
            ) : null}
          </div>
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
        </FormItem>
      )}
    />
  );
};

ActiveField.displayName = "ActiveField";
