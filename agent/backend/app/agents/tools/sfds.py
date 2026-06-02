from langchain_core.tools import tool


@tool
def get_sfds_health() -> dict:
    """
    Check the health status of the SFDS (Sorting and Fault Detection System) backend.

    Returns:
        A dict with 'status', 'cameras', 'message' fields
    """
    from app.services.sfds_service import sfds_service

    return sfds_service.get_health()


@tool
def get_sfds_cameras() -> dict:
    """
    Get the list of cameras connected to SFDS.

    Returns:
        A dict with camera information
    """
    from app.services.sfds_service import sfds_service

    return sfds_service.get_cameras()


@tool
def get_sfds_stats() -> dict:
    """
    Get SFDS statistics and detection metrics.

    Returns:
        A dict with detection stats
    """
    from app.services.sfds_service import sfds_service

    return sfds_service.get_stats()
