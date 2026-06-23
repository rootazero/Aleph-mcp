import asyncio


def test_server_imports_and_registers_eight_tools():
    from aleph_siliconflow_mcp import server

    assert server.mcp.name == "aleph-siliconflow-mcp"
    tools = asyncio.run(server.mcp.list_tools())
    names = {t.name for t in tools}
    assert names == {
        "generate_image",
        "edit_image",
        "generate_video",
        "submit_video_generation",
        "get_video_status",
        "generate_speech",
        "get_user_info",
        "list_models",
    }


def test_main_is_exported():
    from aleph_siliconflow_mcp.main import main

    assert callable(main)
