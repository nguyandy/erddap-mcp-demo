from datetime import datetime, timezone
from fastmcp import FastMCP
import httpx
import urllib.parse
import argparse
import warnings

# Suppress SSL warnings when verification is disabled
warnings.filterwarnings('ignore', message='Unverified HTTPS request')

mcp = FastMCP("erddap-tabledap")
http_client = httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False)


@mcp.tool()
async def get_variable_standard_names(erddap_url: str) -> list[str]:
    """List all variable parameter CF standard names in datasets served by this ERDDAP server.

    These variable parameter standard names can be used when searching an ERDDAP for
    datasets containing variables measuring specific parameters. If we are looking for
    datasets with variables measuring a specific property, we should retrieve this list
    first and then use a discovered standard name value when searching the ERDDAP server.
    """
    url = f"{erddap_url}/categorize/standard_name/index.json"
    params = {
        "page": 1,
        "itemsPerPage": 99999999,
    }

    response = await http_client.get(url, params=params)
    response.raise_for_status()
    return [r[0] for r in response.json()["table"]["rows"]]


@mcp.tool()
async def search_datasets(erddap_url: str, page: int = 1, page_size: int = 50,
                          search_query: str = None, standard_name: str = None,
                          min_longitude: float = None, max_longitude: float = None,
                          min_latitude: float = None, max_latitude: float = None,
                          min_time: datetime = None, max_time: datetime = None):
    """List all datasets in an ERDDAP server"""
    url = f"{erddap_url}/search/advanced.json?tabledap/allDatasets.json"
    params = {
        "protocol": "tabledap",
        "page": page,
        "itemsPerPage": page_size,
    }

    if search_query:
        params["searchFor"] = search_query

    if standard_name:
        params["standard_name"] = standard_name

    if min_longitude:
        params["minLon"] = min_longitude

    if max_longitude:
        params["maxLon"] = max_longitude

    if min_latitude:
        params["minLat"] = min_latitude

    if max_latitude:
        params["maxLat"] = max_latitude

    if min_time:
        params["minTime"] = min_time

    if max_time:
        params["maxTime"] = max_time

    response = await http_client.get(url, params=params)
    response.raise_for_status()
    return [{"dataset_id": r[15], "title": r[6], "summary": r[7]} for r in response.json()["table"]["rows"]]


@mcp.tool()
async def list_datasets(erddap_url: str) -> str:
    """List all datasets in an ERDDAP server"""
    url = (
      f"{erddap_url}/tabledap/allDatasets.csvp?"
      "datasetID,title,minLongitude,maxLongitude,minLatitude,maxLatitude,minTime,maxTime"
    )
    response = await http_client.get(url)
    response.raise_for_status()
    return response.text


@mcp.tool()
async def list_dataset_variables(erddap_url: str, dataset_id: str) -> str:
    """List all variables for a dataset in an ERDDAP server"""
    url = f"{erddap_url}/info/{dataset_id}/index.json"
    response = await http_client.get(url)
    response.raise_for_status()

    var_names = []
    var_long_names = {}
    var_std_names = {}
    var_units = {}
    var_axis = {}

    for row in response.json()["table"]["rows"]:
        row_type, var_name, attr, attr_type, attr_value = row

        if var_name == 'NC_GLOBAL':
            continue

        if row_type == 'variable':
            var_names.append(var_name)
            continue

        if not attr or not attr_value:
            continue

        match attr:
            case "long_name":
                var_long_names[var_name] = attr_value
            case "standard_name":
                var_std_names[var_name] = attr_value
            case "units":
                var_units[var_name] = attr_value
            case "axis":
                var_axis[var_name] = attr_value

    csv_header = "variable_name,long_name,standard_name,units,axis\n"
    csv_data = [
        ",".join([v, var_long_names.get(v, ""), var_std_names.get(v, ""), var_units.get(v, ""), var_axis.get(v, "")])
        for v in var_names
    ]
    return csv_header + "\n".join(csv_data)


@mcp.tool()
async def get_dataset_variable_data(erddap_url: str, dataset_id: str, variable_name: str,
                                    start_time: datetime | None = None,
                                    end_time: datetime | None = datetime.now(timezone.utc),
                                    exclude_nans: bool = True) -> dict:
    """Get data for one or more variables in a dataset served by an ERDDAP server, returned as a CSV file payload.
    
    The variable_name parameter can be:
    - A single variable name (e.g., "temperature")
    - Multiple variables as a comma-separated string (e.g., "temperature,salinity")
    
    When multiple variables are provided, all will be returned in the same CSV with a time column.
    """
    if not dataset_id:
        raise ValueError("dataset_id is required")
    if not variable_name:
        raise ValueError("variable_name is required")

    # Parse variable names - handle both single string and comma-separated list
    variable_names = [v.strip() for v in variable_name.split(",")]
    
    url = f"{erddap_url}/tabledap/{dataset_id}.csvp"

    # Build query with all variables
    variables_str = ",".join(variable_names)
    query_parts = [f"time,{variables_str}"]
    
    # Add NaN filtering for all variables
    if exclude_nans:
        for var_name in variable_names:
            query_parts.append(f"{var_name}!=NaN")

    def _normalize_time(dt: datetime | None) -> datetime | None:
        if dt is None:
            return None
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    start_dt = _normalize_time(start_time)
    end_dt = _normalize_time(end_time)

    if start_dt:
        query_parts.append(f"time>={start_dt.isoformat()}")
    if end_dt:
        query_parts.append(f"time<={end_dt.isoformat()}")

    query = "&".join(query_parts)
    safe_chars = "&,=:+-T"
    encoded_query = urllib.parse.quote(query, safe=safe_chars)

    response = await http_client.get(f"{url}?{encoded_query}")
    response.raise_for_status()

    sanitized_dataset = dataset_id.replace("/", "_")
    
    # Generate filename based on number of variables
    if len(variable_names) == 1:
        sanitized_variable = variable_names[0].replace("/", "_")
        filename = f"{sanitized_dataset}_{sanitized_variable}.csv"
    elif len(variable_names) <= 3:
        sanitized_vars = "_".join([v.replace("/", "_") for v in variable_names])
        filename = f"{sanitized_dataset}_{sanitized_vars}.csv"
    else:
        filename = f"{sanitized_dataset}_multi_variables.csv"

    return {
        "type": "file",
        "mime": "text/csv",
        "filename": filename,
        "content": response.text,
    }


# -------------------------------------------------------------------------
# ENTRY POINT
# -------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="ERDDAP MCP Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "streamable-http"],
        default="stdio",
        help="Transport mode for the MCP server (default: stdio)",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind to for streamable-http transport (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port to bind to for streamable-http transport (default: 8000)",
    )

    args = parser.parse_args()

    if args.transport == "streamable-http":
        print(f"Starting MCP server in Streamable HTTP mode on {args.host}:{args.port}")
        mcp.run(transport="streamable-http", host=args.host, port=args.port)
    else:
        print("Starting MCP server in stdio mode")
        mcp.run(transport="stdio")


if __name__ == "__main__":
    main()