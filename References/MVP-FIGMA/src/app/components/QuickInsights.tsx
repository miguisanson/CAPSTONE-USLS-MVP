import React, { useState } from "react";
import { Info, X, Lightbulb, AlertCircle, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";

// ========================================
// QUICK INSIGHTS - Local Section Explanations
// ========================================
// Icon-only trigger for contextual help on specific cards/sections/charts
// Explains ONLY the selected section, not the whole page

interface QuickInsightsButtonProps {
  className?: string;
  size?: "sm" | "md";
}

export function QuickInsightsButton({ 
  className = "", 
  size = "sm" 
}: QuickInsightsButtonProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button 
            className={`
              inline-flex items-center justify-center
              bg-primary text-primary-foreground
              rounded-full
              hover:bg-primary/90
              focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
              transition-colors
              ${size === "sm" ? "h-6 w-6" : "h-7 w-7"}
              ${className}
            `}
            type="button"
            aria-label="Quick Insights"
          >
            <Info className={`${size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">Quick Insights</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Quick Insight Popover - For brief section-specific explanations
interface QuickInsightPopoverProps {
  title?: string;
  description: string;
  recommendation?: string;
  trigger?: React.ReactNode;
  variant?: "default" | "warning" | "success";
}

export function QuickInsightPopover({ 
  title = "Quick Insight",
  description, 
  recommendation,
  trigger,
  variant = "default"
}: QuickInsightPopoverProps) {
  const [open, setOpen] = useState(false);
  
  const variantStyles = {
    default: "border-primary/20 bg-primary/5",
    warning: "border-warning/20 bg-warning/5",
    success: "border-green-500/20 bg-green-500/5"
  };
  
  const variantIcons = {
    default: <Lightbulb className="h-4 w-4 text-primary" />,
    warning: <AlertCircle className="h-4 w-4 text-warning" />,
    success: <TrendingUp className="h-4 w-4 text-green-600" />
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {trigger || <QuickInsightsButton />}
      </PopoverTrigger>
      <PopoverContent 
        className={`w-80 ${variantStyles[variant]}`}
        align="start"
        sideOffset={5}
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            {variantIcons[variant]}
            <div className="flex-1">
              <p className="font-medium text-sm text-foreground">{title}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setOpen(false)}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="space-y-2 text-sm text-foreground/90">
            <p>{description}</p>
            
            {recommendation && (
              <div className="pt-2 border-t border-border">
                <p className="font-medium text-xs text-muted-foreground mb-1">What to do:</p>
                <p className="text-sm">{recommendation}</p>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t border-border">
            <p className="text-xs text-muted-foreground italic">
              Contextual help for this section only
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Quick Insight Drawer - For deeper section-specific guidance
interface QuickInsightSection {
  title: string;
  content: string;
}

interface QuickInsightDrawerProps {
  title: string;
  description?: string;
  sections: QuickInsightSection[];
  recommendation?: string;
  trigger?: React.ReactNode;
}

export function QuickInsightDrawer({ 
  title,
  description,
  sections, 
  recommendation,
  trigger
}: QuickInsightDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger || <QuickInsightsButton />}
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-5 w-5 text-primary mt-1" />
            <div>
              <SheetTitle className="text-lg">{title}</SheetTitle>
              {description && (
                <SheetDescription className="mt-1">{description}</SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {sections.map((section, index) => (
            <div key={index} className="space-y-2">
              <h4 className="font-medium text-sm text-foreground">{section.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {section.content}
              </p>
            </div>
          ))}
          
          {recommendation && (
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
              <div className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm text-foreground mb-1">
                    What to do next
                  </p>
                  <p className="text-sm text-foreground/90">
                    {recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground italic">
              This explanation is specific to the selected section only.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ========================================
// RECOMMENDED ACTIONS - Page-Level Prescriptive Summary
// ========================================
// Page-wide prescriptive analytics that synthesizes top priorities
// Shows the most important actions for the ENTIRE current page

interface RecommendedAction {
  id: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category?: string;
  link?: string;
}

interface RecommendedActionsProps {
  actions: RecommendedAction[];
  context?: string;
}

export function RecommendedActions({
  actions,
  context = "Based on current workflow data, monitoring alerts, and policy thresholds"
}: RecommendedActionsProps) {
  const priorityConfig = {
    high: {
      icon: <AlertTriangle className="h-4 w-4" />,
      badge: "High Priority",
      badgeVariant: "destructive" as const,
      borderColor: "border-destructive/30",
      bgColor: "bg-destructive/5"
    },
    medium: {
      icon: <AlertCircle className="h-4 w-4" />,
      badge: "Medium Priority",
      badgeVariant: "secondary" as const,
      borderColor: "border-warning/30",
      bgColor: "bg-warning/5"
    },
    low: {
      icon: <Info className="h-4 w-4" />,
      badge: "Low Priority",
      badgeVariant: "outline" as const,
      borderColor: "border-border",
      bgColor: "bg-accent/30"
    }
  };

  if (actions.length === 0) {
    return (
      <Card className="border-green-500/30 bg-green-500/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-foreground">No Critical Actions Required</p>
              <p className="text-sm text-muted-foreground mt-1">
                All current workflows are on track. Continue monitoring for changes.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Recommended Actions</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Top priorities for this page based on current data
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs">
            {actions.length} {actions.length === 1 ? 'Action' : 'Actions'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action) => {
          const config = priorityConfig[action.priority];
          return (
            <div
              key={action.id}
              className={`p-4 rounded-lg border ${config.borderColor} ${config.bgColor} transition-colors hover:bg-accent/50`}
            >
              <div className="flex items-start gap-3">
                <div className={`${action.priority === 'high' ? 'text-destructive' : action.priority === 'medium' ? 'text-warning' : 'text-muted-foreground'} mt-0.5`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-medium text-sm text-foreground">{action.title}</p>
                    <Badge variant={config.badgeVariant} className="text-xs flex-shrink-0">
                      {config.badge}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {action.description}
                  </p>
                  {action.category && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Category:</span> {action.category}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        
        <div className="pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground italic flex items-start gap-2">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
            <span>{context}. Recommendations are advisory only and require user review.</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
