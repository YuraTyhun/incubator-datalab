package com.epam.dlab.automation.helper;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import com.epam.dlab.automation.http.HttpRequest;
import com.epam.dlab.automation.http.HttpStatusCode;
import com.epam.dlab.automation.repository.ContentType;
import com.jayway.restassured.path.json.JsonPath;

public class WaitForStatus {
    private final static Logger LOGGER = LogManager.getLogger(WaitForStatus.class);
    
    private static long getSsnRequestTimeout() {
    	return ConfigPropertyValue.isRunModeLocal() ? 500 : 10000;
    }
    
    public static boolean selfService(String ssnURL, Duration duration) throws InterruptedException {
        HttpRequest request = new HttpRequest();
        int actualStatus;
        long timeout = duration.toMillis();
        long expiredTime = System.currentTimeMillis() + timeout;

		while ((actualStatus = request.webApiGet(ssnURL, ContentType.TEXT).statusCode()) != HttpStatusCode.OK) {
            if (timeout != 0 && expiredTime < System.currentTimeMillis()) {
                break;
            }
            Thread.sleep(getSsnRequestTimeout());
        }

        if (actualStatus != HttpStatusCode.OK) {
            LOGGER.info("ERROR: Timeout has been expired for SSN available. Timeout was {}", duration);
            return false;
        } else {
    		LOGGER.info("Current status code for SSN is {}", actualStatus);
    	}
        
        return true;
    }

    public static int uploadKey(String url, String token, int status, Duration duration)
            throws InterruptedException {
    	LOGGER.info(" Waiting until status code {} with URL {} with token {}", status, url, token);
        HttpRequest request = new HttpRequest();
        int actualStatus;
        long timeout = duration.toMillis();
        long expiredTime = System.currentTimeMillis() + timeout;

        while ((actualStatus = request.webApiGet(url, token).getStatusCode()) == status) {
            if (timeout != 0 && expiredTime < System.currentTimeMillis()) {
                break;
            }
            Thread.sleep(getSsnRequestTimeout());
        }

        if (actualStatus == status) {
            LOGGER.info("ERROR: {}: Timeout has been expired for request.");
            LOGGER.info("  URL is {}", url);
            LOGGER.info("  token is {}", token);
            LOGGER.info("  status is {}", status);
            LOGGER.info("  timeout is {}", duration);
    	} else {
    		LOGGER.info(" Current status code for {} is {}", url, actualStatus);
    	}

        return actualStatus;
    }

    public static String notebook(String url, String token, String notebookName, String status, Duration duration)
            throws InterruptedException {
    	LOGGER.info("Waiting until status {} with URL {} with token {} for notebook {}",status, url, token, notebookName);
        HttpRequest request = new HttpRequest();
        String actualStatus;
        long timeout = duration.toMillis();
        long expiredTime = System.currentTimeMillis() + timeout;

        while ((actualStatus = getNotebookStatus(request.webApiGet(url, token)
        											.getBody()
        											.jsonPath(), notebookName)).equals(status)) {
            if (timeout != 0 && expiredTime < System.currentTimeMillis()) {
                break;
            }
            Thread.sleep(getSsnRequestTimeout());
        }

        if (actualStatus.contains(status)) {
            LOGGER.info("ERROR: {}: Timeout has been expired for request.", notebookName);
            LOGGER.info("  {}: URL is {}", notebookName, url);
            LOGGER.info("  {}: token is {}", notebookName, token);
            LOGGER.info("  {}: status is {}", notebookName, status);
            LOGGER.info("  {}: timeout is {}", notebookName, duration);
        } else {
        	LOGGER.info("{}: Current state for Notebook {} is {}", notebookName, notebookName, actualStatus );
        }
        
        return actualStatus;
    }
    
    public static String emr(String url, String token, String notebookName, String computationalName, String status, Duration duration)
            throws InterruptedException {
    	LOGGER.info("{}: Waiting until status {} with URL {} with token {} for computational {} on notebook ", notebookName, status, url, token, computationalName, notebookName);
        HttpRequest request = new HttpRequest();
        String actualStatus;
        long timeout = duration.toMillis();
        long expiredTime = System.currentTimeMillis() + timeout;

        while ((actualStatus = getEmrStatus(request.webApiGet(url, token)
        											.getBody()
        											.jsonPath(), notebookName, computationalName)).equals(status)) {
            if (timeout != 0 && expiredTime < System.currentTimeMillis()) {
                break;
            }
            Thread.sleep(getSsnRequestTimeout());
        }

        if (actualStatus.contains(status)) {
            LOGGER.info("ERROR: Timeout has been expired for request.");
            LOGGER.info("  URL is {}",  url);
            LOGGER.info("  token is {}", token);
            LOGGER.info("  status is {}", status);
            LOGGER.info("  timeout is {}", duration);
        } else {
        	LOGGER.info("{}: Current state for EMR {} on notebook {} is ", notebookName, computationalName, notebookName, actualStatus);
        }
        
        return actualStatus;
    }

    public static String getEmrStatus(JsonPath json, String notebookName, String computationalName) {
    	List<Map<String, List<Map<String, String>>>> notebooks = json
				.param("name", notebookName)
				.getList("findAll { notebook -> notebook.exploratory_name == name }");
        if (notebooks == null || notebooks.size() != 1) {
        	return "";
        }
        List<Map<String, String>> resources = notebooks.get(0)
        		.get("computational_resources");
        for (Map<String, String> resource : resources) {
            String comp = resource.get("computational_name");
            if (comp != null && comp.equals(computationalName)) {
            	return resource.get("status");
            }
		}
		return "";
    }
    
    private static String getNotebookStatus(JsonPath json, String notebookName) {
    	List<Map<String, String>> notebooks = json
				.param("name", notebookName)
				.getList("findAll { notebook -> notebook.exploratory_name == name }");
        if (notebooks == null || notebooks.size() != 1) {
        	return "";
        }
        Map<String, String> notebook = notebooks.get(0);
        String status = notebook.get("status");
        return (status == null ? "" : status);
    }
}
