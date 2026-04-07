import { Octokit } from "@octokit/rest";

function getOctokit(): Octokit {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is not set");
  }
  return new Octokit({ auth: token });
}

function getRepoInfo(): { owner: string; repo: string } {
  const repoStr = process.env.GITHUB_REPO;
  if (!repoStr) {
    throw new Error(
      "GITHUB_REPO environment variable is not set (expected format: owner/repo)"
    );
  }
  const [owner, repo] = repoStr.split("/");
  if (!owner || !repo) {
    throw new Error(
      `Invalid GITHUB_REPO format: "${repoStr}". Expected "owner/repo".`
    );
  }
  return { owner, repo };
}

/**
 * Deploy an HTML file to GitHub Pages by creating/updating a file in the repo.
 * The file is placed at `sites/{slug}/index.html`.
 *
 * Returns the GitHub Pages URL where the site will be accessible.
 */
export async function deployToGitHubPages(
  slug: string,
  html: string
): Promise<string> {
  const octokit = getOctokit();
  const { owner, repo } = getRepoInfo();
  const path = `sites/${slug}/index.html`;
  const content = Buffer.from(html).toString("base64");
  const message = `Deploy demo site for ${slug}`;

  // Check if file already exists to get its SHA (needed for updates)
  let existingSha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    if (!Array.isArray(data) && data.type === "file") {
      existingSha = data.sha;
    }
  } catch (error: unknown) {
    // 404 means file doesn't exist yet — that's fine
    if (
      error instanceof Error &&
      "status" in error &&
      (error as { status: number }).status !== 404
    ) {
      throw error;
    }
  }

  await octokit.repos.createOrUpdateFileContents({
    owner,
    repo,
    path,
    message,
    content,
    sha: existingSha,
    branch: "main",
  });

  // Construct the GitHub Pages URL
  const pagesUrl = `https://${owner}.github.io/${repo}/sites/${slug}/`;
  return pagesUrl;
}
