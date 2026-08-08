import type { TeamMember } from "../types/team";

interface AssigneeSelectProps {
  id: string;
  value: string | null;
  members: TeamMember[];
  ariaLabel?: string;
  disabled?: boolean;
  onChange: (assigneeId: string | null) => void;
}

export function AssigneeSelect({
  id,
  value,
  members,
  ariaLabel,
  disabled = false,
  onChange,
}: AssigneeSelectProps) {
  return (
    <select
      id={id}
      className="assignee-select"
      value={value ?? ""}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Unassigned</option>
      {members.map((member) => (
        <option key={member.id} value={member.id}>
          {member.name}
        </option>
      ))}
    </select>
  );
}
