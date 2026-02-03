"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";
import { Button } from "@/components/atoms/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/atoms/popover";
import { useAppTour } from "@/components/organisms/AppTour";

export const DashboardHeader = () => {
  const tour = useAppTour();

  return (
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Credit Import Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Import credit report files to view and analyze bureau data
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Tour
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72">
              <div className="space-y-3">
                <div className="text-sm font-medium text-foreground">Guided walkthrough</div>
                <div className="space-y-2">
                  <Button type="button" className="w-full justify-start" onClick={tour.start}>
                    Start from beginning
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start"
                    onClick={tour.resume}
                    disabled={!tour.hasSavedProgress}
                  >
                    Resume
                  </Button>
                </div>
                <div className="pt-2 border-t space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Jump to section</div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => tour.startSection("import")}>Import</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => tour.startSection("analyze")}>Disputes</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => tour.startSection("letter")}>Letter</Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => tour.startSection("mail")}>Mail</Button>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <Button type="button" variant="ghost" size="sm" className="w-full justify-start" onClick={tour.reset}>
                    Reset saved progress
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-foreground">Business User</div>
            <div className="text-xs text-muted-foreground">Credit Analyst</div>
          </div>
          <Avatar className="h-10 w-10 border-2 border-primary/20">
            <AvatarImage src="" alt="User avatar" />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">BU</AvatarFallback>
          </Avatar>
        </div>
      </header>
  )
}
