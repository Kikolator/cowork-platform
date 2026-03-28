interface AvailabilityGateProps {
  available: boolean;
  spotsLeft?: number;
  unavailableMessage: string;
  children: React.ReactNode;
}

export function AvailabilityGate({
  available,
  spotsLeft,
  unavailableMessage,
  children,
}: AvailabilityGateProps) {
  if (!available) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg font-medium text-foreground">
          {unavailableMessage}
        </p>
        <p className="text-sm text-muted-foreground">
          Please contact the space for more information.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {spotsLeft !== undefined && spotsLeft <= 5 && (
        <p className="text-center text-sm text-amber-600">
          Only {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left
        </p>
      )}
      {children}
    </div>
  );
}
