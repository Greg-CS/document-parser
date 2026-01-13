import { Avatar, AvatarFallback, AvatarImage } from "@/components/atoms/avatar";

export const DashboardHeader = () => {
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
