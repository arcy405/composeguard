import { buildIssue } from "./shared.js";

export function runDockerComposeRules(parsedCompose) {
  const issues = [];
  const services = parsedCompose?.services || {};

  for (const [serviceName, service] of Object.entries(services)) {
    const image = String(service.image || "");
    if (image.endsWith(":latest") || (!image.includes(":") && image.length > 0)) {
      issues.push(
        buildIssue({
          id: "DC001",
          severity: "high",
          category: "security",
          message: `Service "${serviceName}" uses a floating image tag.`,
          simple: "Using latest can pull unexpected image changes.",
          expert:
            "Mutable tags reduce reproducibility and can introduce unreviewed runtime changes. Pin immutable tags or digests.",
          location: `services.${serviceName}.image`
        })
      );
    }

    if (!service.restart) {
      issues.push(
        buildIssue({
          id: "DC002",
          severity: "medium",
          category: "reliability",
          message: `Service "${serviceName}" has no restart policy.`,
          simple: "Container may stay down after crashes.",
          expert:
            "Explicit restart policies improve resilience in transient failure conditions and host reboots.",
          location: `services.${serviceName}.restart`
        })
      );
    }

    if (service.privileged === true) {
      issues.push(
        buildIssue({
          id: "DC003",
          severity: "critical",
          category: "security",
          message: `Service "${serviceName}" runs in privileged mode.`,
          simple: "Privileged mode gives the container near-host level access.",
          expert:
            "Privileged containers bypass critical isolation boundaries and significantly increase host compromise blast radius.",
          location: `services.${serviceName}.privileged`
        })
      );
    }

    if (Array.isArray(service.ports) && service.ports.length > 0) {
      issues.push(
        buildIssue({
          id: "DC004",
          severity: "medium",
          category: "security",
          message: `Service "${serviceName}" exposes host ports.`,
          simple: "Exposed ports increase attack surface.",
          expert:
            "Review whether public bind is required; prefer internal networking, strict firewall rules, or binding to localhost.",
          location: `services.${serviceName}.ports`
        })
      );
    }

    if (!service.healthcheck) {
      issues.push(
        buildIssue({
          id: "DC005",
          severity: "low",
          category: "performance",
          message: `Service "${serviceName}" has no healthcheck.`,
          simple: "The platform cannot reliably detect unhealthy containers.",
          expert:
            "Healthchecks improve orchestration decisions and reduce time-to-recovery by allowing automated failure detection.",
          location: `services.${serviceName}.healthcheck`
        })
      );
    }

    if (service.read_only !== true) {
      issues.push(
        buildIssue({
          id: "DC006",
          severity: "medium",
          category: "security",
          message: `Service "${serviceName}" is not configured as read-only.`,
          simple: "Writable root filesystem can increase impact during compromise.",
          expert:
            "Using read-only root filesystems reduces mutable attack surface and persistence opportunities in compromised containers.",
          location: `services.${serviceName}.read_only`
        })
      );
    }

    if (!service.mem_limit && !service.deploy?.resources?.limits?.memory) {
      issues.push(
        buildIssue({
          id: "DC007",
          severity: "medium",
          category: "performance",
          message: `Service "${serviceName}" has no memory limit.`,
          simple: "A runaway process can consume excessive memory.",
          expert:
            "Memory limits protect host stability and improve workload isolation. Use deploy.resources.limits.memory or mem_limit where supported.",
          location: `services.${serviceName}.deploy.resources.limits.memory`
        })
      );
    }

    const loggingOpts = service.logging?.options || {};
    if (!loggingOpts["max-size"] || !loggingOpts["max-file"]) {
      issues.push(
        buildIssue({
          id: "DC008",
          severity: "low",
          category: "reliability",
          message: `Service "${serviceName}" has no log rotation limits.`,
          simple: "Unbounded logs can fill disk over time.",
          expert:
            "Set max-size and max-file in logging options to control disk growth and reduce node-level stability risk.",
          location: `services.${serviceName}.logging.options`
        })
      );
    }
  }

  return issues;
}

export function runDockerfileRules(parsedDockerfile) {
  const issues = [];
  const instructions = parsedDockerfile?.instructions || [];

  const from = instructions.find((x) => x.instruction === "FROM");
  if (from && (from.value.endsWith(":latest") || !from.value.includes(":"))) {
    issues.push(
      buildIssue({
        id: "DF001",
        severity: "high",
        category: "security",
        message: "Dockerfile base image uses mutable tag.",
        simple: "Base image version can change without notice.",
        expert:
          "Pinning versioned tags or digests ensures deterministic builds and improves supply-chain traceability.",
        location: `Dockerfile:${from.line}`
      })
    );
  }

  const hasUser = instructions.some((x) => x.instruction === "USER");
  if (!hasUser) {
    issues.push(
      buildIssue({
        id: "DF002",
        severity: "high",
        category: "security",
        message: "Dockerfile does not switch to a non-root user.",
        simple: "Container likely runs as root by default.",
        expert:
          "Running as root magnifies impact of runtime compromise. Use USER with least privilege and ownership adjustments.",
        location: "Dockerfile"
      })
    );
  }

  const addInstruction = instructions.find((x) => x.instruction === "ADD");
  if (addInstruction) {
    issues.push(
      buildIssue({
        id: "DF003",
        severity: "low",
        category: "maintainability",
        message: "Dockerfile uses ADD; prefer COPY unless archive/url semantics are needed.",
        simple: "COPY is usually clearer and safer than ADD.",
        expert:
          "ADD has implicit behaviors (archive extraction, remote URLs) that can create ambiguity in layer behavior and cache invalidation.",
        location: `Dockerfile:${addInstruction.line}`
      })
    );
  }

  const hasHealthcheck = instructions.some((x) => x.instruction === "HEALTHCHECK");
  if (!hasHealthcheck) {
    issues.push(
      buildIssue({
        id: "DF004",
        severity: "medium",
        category: "reliability",
        message: "Dockerfile has no HEALTHCHECK.",
        simple: "Health state is not explicitly defined.",
        expert:
          "HEALTHCHECK enables runtime supervision tooling to identify degraded containers and restart or isolate them.",
        location: "Dockerfile"
      })
    );
  }

  const hasWorkdir = instructions.some((x) => x.instruction === "WORKDIR");
  if (!hasWorkdir) {
    issues.push(
      buildIssue({
        id: "DF005",
        severity: "low",
        category: "maintainability",
        message: "Dockerfile does not define WORKDIR.",
        simple: "Relative path behavior may become unclear between layers.",
        expert:
          "Declaring WORKDIR improves Dockerfile readability and prevents fragile relative-path assumptions across image layers.",
        location: "Dockerfile"
      })
    );
  }

  const hasAptInstallNoCleanup = instructions.some(
    (x) =>
      x.instruction === "RUN" &&
      x.value.includes("apt-get install") &&
      !x.value.includes("rm -rf /var/lib/apt/lists")
  );
  if (hasAptInstallNoCleanup) {
    issues.push(
      buildIssue({
        id: "DF006",
        severity: "low",
        category: "performance",
        message: "apt-get install is used without cleaning apt lists.",
        simple: "Image size may be larger than necessary.",
        expert:
          "Combining apt install with apt cache cleanup in the same RUN layer reduces image size and transfer overhead.",
        location: "Dockerfile"
      })
    );
  }

  return issues;
}

