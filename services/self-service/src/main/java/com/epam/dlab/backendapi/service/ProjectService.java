/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package com.epam.dlab.backendapi.service;

import com.epam.dlab.auth.UserInfo;
import com.epam.dlab.backendapi.domain.ProjectDTO;
import com.epam.dlab.backendapi.domain.UpdateProjectDTO;

import java.util.List;

public interface ProjectService {
	List<ProjectDTO> getProjects();

	List<ProjectDTO> getProjects(UserInfo user);

	List<ProjectDTO> getUserProjects(UserInfo userInfo, boolean active);

	List<ProjectDTO> getProjectsByEndpoint(String endpointName);

	void create(UserInfo userInfo, ProjectDTO projectDTO);

	ProjectDTO get(String name);

	void terminateEndpoint(UserInfo userInfo, String endpoint, String name);

	void terminateEndpoint(UserInfo userInfo, List<String> endpoints, String name);

	void start(UserInfo userInfo, String endpoint, String name);

	void start(UserInfo userInfo, List<String> endpoints, String name);

	void stop(UserInfo userInfo, String endpoint, String name);

	void stopWithResources(UserInfo userInfo, List<String> endpoints, String projectName);

	void update(UserInfo userInfo, UpdateProjectDTO projectDTO, String projectName);

	void updateBudget(List<ProjectDTO> projects);

	boolean isAnyProjectAssigned(UserInfo userInfo);

	boolean checkExploratoriesAndComputationalProgress(String projectName, List<String> endpoints);
}
