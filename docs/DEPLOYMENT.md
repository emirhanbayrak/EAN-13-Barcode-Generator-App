# Deployment Guide: Vercel via GitHub

This guide provides instructions on how to deploy this static React application to Vercel using its GitHub integration.

Since this application is built as a modern static web app using ES modules and does not require a separate build step, deployment is straightforward. We just need to serve the existing files from the project root.

---

## Deploying to Vercel

Vercel offers a seamless deployment experience for frontend applications with deep GitHub integration and automatic deployments.

### Prerequisites

*   A GitHub account.
*   Your application code pushed to a GitHub repository.
*   A Vercel account (you can sign up for free with your GitHub account).

### Steps

1.  **Push Your Code to a GitHub Repository**

    If you haven't already, create a new repository on GitHub and push all your application files to it.

2.  **Log in to Vercel and Import Project**

    *   Go to your [Vercel Dashboard](https://vercel.com/dashboard).
    *   Click on **"Add New..."** and select **"Project"**.

3.  **Import Your GitHub Repository**

    *   The "Import Git Repository" screen will appear.
    *   Find the repository you created in step 1 and click **"Import"**. If you don't see it, you may need to configure the Vercel GitHub App to grant it access.

4.  **Configure Your Project**

    Vercel is very good at auto-detecting project settings. However, since our project is a simple static site without a `package.json`, you may need to override the defaults.

    *   **Framework Preset:** Vercel might not detect a specific framework. If so, select **"Other"**.
    *   **Build and Output Settings:**
        *   **Turn OFF the "Build Command" toggle.** We don't have a build step.
        *   **Turn OFF the "Output Directory" toggle.** Vercel will correctly serve files from the project root where `index.html` is located.
    
    *   **Environment Variables:** This application does not require any environment variables.

5.  **Deploy**

    *   Click the **"Deploy"** button.
    *   Vercel will immediately deploy your site. This process is very fast for static sites.

6.  **Access Your Deployed App**

    *   Once deployment is complete, Vercel will provide you with a public URL (e.g., `your-project-name.vercel.app`).
    *   Congratulations! Your app is live.

### Automatic Deployments (CI/CD)

With this setup, every time you push a new commit to your main branch on GitHub, Vercel will automatically trigger a new deployment, keeping your live application up-to-date with your latest code.
