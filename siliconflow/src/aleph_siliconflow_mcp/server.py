"""FastMCP server: registers all SiliconFlow media tools."""

from mcp.server.fastmcp import FastMCP

from . import audio, images, user, videos

mcp = FastMCP("aleph-siliconflow-mcp")

mcp.tool()(images.generate_image)
mcp.tool()(images.edit_image)
mcp.tool()(videos.generate_video)
mcp.tool()(videos.submit_video_generation)
mcp.tool()(videos.get_video_status)
mcp.tool()(audio.generate_speech)
mcp.tool()(user.get_user_info)
mcp.tool()(user.list_models)


def main() -> None:
    mcp.run()
