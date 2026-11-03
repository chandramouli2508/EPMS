
import { useEffect, useState } from "react";

function Projects() {
    const [projects, setProjects] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const controller = new AbortController();

        async function fetchProjects() {
            try {
                setIsLoading(true);
                setError(null);

                const response = await fetch("/api/projects", {
                    signal: controller.signal,
                });

                if (!response.ok) {
                    throw new Error(
                        `Request failed: ${response.status}`
                    );
                }

                const data = await response.json();

                if (!Array.isArray(data)) {
                    throw new Error("Invalid projects response");
                }

                setProjects(data);
            } catch (err) {
                if (err.name === "AbortError") {
                    return;
                }

                setError(err.message || "Failed to load projects");
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            }
        }

        fetchProjects();

        return () => {
            controller.abort();
        };
    }, []);

    if (isLoading) {
        return <p>Loading projects...</p>;
    }

    if (error) {
        return <p role="alert">Error: {error}</p>;
    }

    if (projects.length === 0) {
        return <p>No projects found.</p>;
    }

    return (
        <div>
            {projects.map((project) => (
                <p key={project.id}>{project.name}</p>
            ))}
        </div>
    );
}

export default Projects;
