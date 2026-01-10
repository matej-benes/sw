"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { XCircle, CheckCircle, ChevronDown, XIcon, WandSparkles } from "lucide-react"

import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command";


const multiSelectVariants = cva(
    "m-1",
    {
        variants: {
            variant: {
                default:
                    "border-foreground bg-secondary/10 text-secondary-foreground hover:bg-secondary/20",
                secondary:
                    "border-foreground/50 bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                inverted: "inverted",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
);

interface MultiSelectProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof multiSelectVariants> {
    options: {
        label: string;
        value: string;
        icon?: React.ComponentType<{ className?: string }>;
    }[];
    onValueChange: (value: string[]) => void;
    defaultValue: string[];
    placeholder?: string;
    animation?: number;
    maxCount?: number;
    asChild?: boolean;
    className?: string;
}

export const MultiSelect = React.forwardRef<
    HTMLButtonElement,
    MultiSelectProps
>(
    (
        {
            options,
            onValueChange,
            variant,
            defaultValue = [],
            placeholder = "Select options",
            animation = 0,
            maxCount = 3,
            asChild = false,
            className,
            ...props
        },
        ref
    ) => {
        const [selectedValues, setSelectedValues] = React.useState<string[]>(defaultValue);
        const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);

        React.useEffect(() => {
            setSelectedValues(defaultValue)
        }, [defaultValue])

        const handleInputKeyDown = (
            event: React.KeyboardEvent<HTMLInputElement>
        ) => {
            if (event.key === "Enter") {
                setIsPopoverOpen(true);
            } else if (event.key === "Backspace" && !event.currentTarget.value) {
                const newSelectedValues = [...selectedValues];
                newSelectedValues.pop();
                setSelectedValues(newSelectedValues);
                onValueChange(newSelectedValues);
            }
        };

        const toggleOption = (value: string) => {
            const newSelectedValues = selectedValues.includes(value)
                ? selectedValues.filter((v) => v !== value)
                : [...selectedValues, value];
            setSelectedValues(newSelectedValues);
            onValueChange(newSelectedValues);
        };

        return (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <PopoverTrigger asChild>
                    <Button
                        ref={ref}
                        {...props}
                        onClick={() => setIsPopoverOpen(!isPopoverOpen)}
                        className={cn("flex w-full min-h-10 p-1 rounded-md border border-input bg-transparent hover:bg-transparent", className)}
                    >
                        {selectedValues.length > 0 ? (
                            <div className="flex justify-between items-center w-full">
                                <div className="flex flex-wrap items-center">
                                    {selectedValues.slice(0, maxCount).map((value) => {
                                        const option = options.find((o) => o.value === value);
                                        const Icon = option?.icon;
                                        return (
                                            <Badge
                                                key={value}
                                                className={cn(multiSelectVariants({ variant, className }))}
                                            >
                                                {Icon && <Icon className="mr-2 h-4 w-4" />}
                                                {option?.label}
                                                <XCircle
                                                    className="ml-2 h-4 w-4 cursor-pointer"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        toggleOption(value);
                                                    }}
                                                />
                                            </Badge>
                                        );
                                    })}
                                    {selectedValues.length > maxCount && (
                                        <Badge
                                            className={cn(
                                                "bg-transparent text-foreground border-foreground/50",
                                                multiSelectVariants({ variant, className })
                                            )}
                                        >
                                            +{selectedValues.length - maxCount}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between">
                                    <XIcon
                                        className="h-4 w-4 text-muted-foreground cursor-pointer"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setSelectedValues([]);
                                            onValueChange([])
                                        }}
                                    />
                                    <Separator
                                        orientation="vertical"
                                        className="h-full min-h-6 mx-2"
                                    />
                                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between w-full mx-auto">
                                <span className="text-sm text-muted-foreground mx-3">
                                    {placeholder}
                                </span>
                                <ChevronDown className="h-4 w-4 text-muted-foreground mx-2" />
                            </div>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-full p-0"
                    align="start"
                    onEscapeKeyDown={() => setIsPopoverOpen(false)}
                >
                    <Command>
                        <CommandInput
                            placeholder="Hledat..."
                            onKeyDown={handleInputKeyDown}
                        />
                        <CommandList>
                            <CommandEmpty>Žádné výsledky.</CommandEmpty>
                            <CommandGroup>
                                {options.map((option) => {
                                    const isSelected = selectedValues.includes(option.value);
                                    return (
                                        <CommandItem
                                            key={option.value}
                                            onSelect={() => toggleOption(option.value)}
                                            style={{
                                                pointerEvents: "auto",
                                                opacity: 1,
                                            }}
                                            className="cursor-pointer"
                                        >
                                            <div
                                                className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}
                                            >
                                                <CheckCircle className={cn("h-4 w-4")} />
                                            </div>
                                            {option.icon && (
                                                <option.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                                            )}
                                            <span>{option.label}</span>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                                <div className="flex items-center justify-between">
                                    {selectedValues.length > 0 && (
                                        <>
                                            <CommandItem
                                                onSelect={() => {
                                                    setSelectedValues([]);
                                                    onValueChange([])
                                                }}
                                                style={{
                                                    pointerEvents: "auto",
                                                    opacity: 1,
                                                }}
                                                className="flex-1 justify-center cursor-pointer"
                                            >
                                                Smazat
                                            </CommandItem>
                                            <Separator
                                                orientation="vertical"
                                                className="flex min-h-6 h-full"
                                            />
                                        </>
                                    )}
                                    <CommandItem
                                        onSelect={() => setIsPopoverOpen(false)}
                                        style={{
                                            pointerEvents: "auto",
                                            opacity: 1,
                                        }}
                                        className="flex-1 justify-center cursor-pointer"
                                    >
                                        Zavřít
                                    </CommandItem>
                                </div>
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        );
    }
);

MultiSelect.displayName = "MultiSelect";